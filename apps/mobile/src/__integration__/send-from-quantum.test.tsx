/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// PQ-006 / PERA-4488: quantum accounts now route end-to-end through the signing
// state machine via the dedicated `quantumSignerActor` + `createQuantumStrategy`,
// producing a `QuantumSignedTransaction` carrier. The second test below drives a
// real quantum payment through the machine and proves the carrier is produced.
//
// Actual submission stays GATED/synthetic (out of scope, PQ-019): the local
// send self-submits via the callback transport, whose delivery step
// (`assertNoQuantumSignedTransactions`) deliberately refuses a Falcon pqsig
// carrier — no node accepts it yet. So the machine SIGNS the payment (carrier
// produced) but delivery is gated and NO algod `/v2/transactions` broadcast ever
// happens, which is exactly what the test asserts.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useKMS, type QuantumKeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'

import {
    buildPaymentTransaction,
    buildTransactionSignRequest,
    renderSignReview,
} from '@test-utils/signing-review'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC,
} from './__fixtures__/quantum'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS

const SLOW_TEST_TIMEOUT_MS = 30_000

const QUANTUM_FLAG_KEY = 'enable_quantum_accounts'

const enableQuantumFlag = async (): Promise<void> => {
    await useRemoteConfigStore.persist.rehydrate()
    useRemoteConfigStore.getState().setConfigOverride(QUANTUM_FLAG_KEY, true)
}

// Mint a REAL quantum (Falcon-mock) key in the in-memory keystore from the
// pinned quantum mnemonic and register the matching account in the accounts
// store. `keyPairId` is the derived signing CHILD id (`signKeyId`) — what
// `account.keyPairId` is documented to hold, and what the signing pipeline
// resolves back to the parent seed at sign time.
const seedQuantumSender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonic: QUANTUM_TEST_MNEMONIC,
        })
        expect(keyResult).not.toBeNull()
    })

    const sender: WalletAccount = {
        id: 'quantum-sender-1',
        type: AccountTypes.quantum,
        address: QUANTUM_TEST_ADDRESS,
        keyPairId: keyResult!.signKeyId,
        name: 'Quantum sender',
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountAddress(sender.address)
    return sender
}

const renderSendConfirmationStack = () =>
    renderWithNavigation(TransactionConfirmationScreen, 'ConfirmTransaction', {
        additionalScreens: [
            {
                name: 'TransactionProcessing',
                component: TransactionProcessingScreen,
            },
            {
                name: 'TransactionSuccess',
                component: TransactionSuccessScreen,
            },
        ],
    })

describe('send from quantum account (PQ-015)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        useNetworkStore.getState().setNetwork('mainnet')
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(Notifier.showNotification).mockClear()

        // Enough for the 1-ALGO send + 0.003 quantum fee + MBR.
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: QUANTUM_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: RECEIVER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given the quantum flag is on and a real quantum sender, when the send confirmation screen settles, then it shows the 0.003 ALGO quantum fee and the quantum-fee explainer',
        async () => {
            await enableQuantumFlag()
            await seedQuantumSender()

            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            // The confirm button only mounts once isReady === true — the signal
            // that the fee row has settled.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('send_confirm_button'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            // The fee shown to the user already reflects the PQ multiplier:
            // 1000 µAlgo base fee × the remote-config pqMultiplier (fallback 3)
            // = 3000 µAlgo = 0.003 ALGO, alongside the quantum-fee explainer.
            expect(
                await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeTruthy()
            expect(await screen.findByText('0.003')).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a real quantum sender, when a local payment is signed, then the machine routes it through the quantum strategy to a QuantumSignedTransaction carrier and delivery is gated with no algod broadcast',
        async () => {
            await enableQuantumFlag()
            await seedQuantumSender()

            // A real payment from the quantum sender. Enqueued as a LOCAL
            // callback request — the same transport the send-funds flow uses —
            // so the machine signs headlessly (no review sheet) and then hits
            // the callback delivery step.
            const payment = buildPaymentTransaction({
                sender: QUANTUM_TEST_ADDRESS,
                receiver: RECEIVER_ADDRESS,
                amount: 1_000_000n,
                fee: 1000n,
            })
            const { request, error: errorSpy } = buildTransactionSignRequest({
                sourceType: 'local',
                txs: [payment],
            })

            // Any algod broadcast is a failure: a Falcon-signed group must
            // never be POSTed to a node that cannot verify it.
            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'SHOULDNOTBEHIT00000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSignReview(request)

            // The machine dispatches the group to quantumSignerActor, the
            // dedicated strategy produces a QuantumSignedTransaction carrier,
            // and the callback delivery step then refuses to hand a Falcon
            // carrier to an external consumer — surfacing the gate error.
            await waitFor(
                () => {
                    expect(errorSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            // The callback-delivery gate only fires AFTER signing produced a
            // pqsig carrier — its presence is the load-bearing proof that the
            // quantum account signed the payment end-to-end through the machine.
            // Matching the delivery-specific message (not just any "quantum"
            // error) rules out an earlier signing rejection — e.g. a stale
            // "Unsupported account type: quantum" — masquerading as this
            // outcome.
            const gateError = errorSpy.mock.calls[0]?.[0] as Error
            expect(String(gateError?.message)).toMatch(
                /cannot be delivered via the callback transport/i,
            )

            // No node ever saw the Falcon-signed group.
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
