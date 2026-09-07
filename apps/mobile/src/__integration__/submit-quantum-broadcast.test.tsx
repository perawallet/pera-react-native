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

// a Falcon-signed group is broadcast through the ordinary
// submission path — quantum is not special-cased at submit time. The
// carrier-aware `encodeSignedTransaction` emits the node-ready `pqsig` bytes,
// so a quantum payment over the ALGOD transport reaches algod's
// send-raw-transaction endpoint exactly like any other account's send. It
// therefore confirms only against a `pqsig`-capable node (LocalNet until an
// official algod ships Falcon support); other nodes reject it at submit.
//
// This test drives a real quantum payment through the signing state machine
// over the algod transport and asserts the group is broadcast for real.

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
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
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

import {
    buildPaymentTransaction,
    buildTransactionSignRequest,
    renderSignReview,
} from '@test-utils/signing-review'

import { HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import {
    QUANTUM_TEST_ADDRESS,
    QUANTUM_TEST_MNEMONIC_INDICES,
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
// store. `keyPairId` is the derived signing CHILD id (`signKeyId`).
const seedQuantumSender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: QuantumKeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createQuantumKey({
            mnemonicIndices: QUANTUM_TEST_MNEMONIC_INDICES,
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

describe('submit from quantum account over algod transport', () => {
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
        useRemoteConfigStore.getState().resetState()
        vi.mocked(Notifier.showNotification).mockClear()

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
        'Given a real quantum sender, when a payment is signed over the algod transport, then the Falcon group is broadcast to algod through the ordinary submission path',
        async () => {
            await enableQuantumFlag()
            await seedQuantumSender()

            const payment = buildPaymentTransaction({
                sender: QUANTUM_TEST_ADDRESS,
                receiver: RECEIVER_ADDRESS,
                amount: 1_000_000n,
                fee: 1000n,
            })
            const { request, error: errorSpy } = buildTransactionSignRequest({
                sourceType: 'local',
                txs: [payment],
                overrides: { transport: 'algod' },
            })

            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'REALQUANTUMTXID000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSignReview(request)

            // The load-bearing assertion: quantum bytes reached algod's
            // send-raw-transaction endpoint — i.e. the group was broadcast for
            // real, not routed to a synthetic/mock submission.
            await waitFor(
                () => {
                    expect(sendSpy).toHaveBeenCalled()
                },
                { timeout: 15_000 },
            )

            // Signing/broadcast surfaced no error to the request originator.
            expect(errorSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
