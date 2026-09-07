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
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import { Decimal } from 'decimal.js'
import { renderHook, screen, waitFor } from '@testing-library/react'
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
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'

import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { QUANTUM_FEE_EXPLAINER_TEST_ID } from '@modules/transactions/components/QuantumFeeExplainer'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import { useNetworkStore } from '@perawallet/wallet-core-blockchain'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS

const SLOW_TEST_TIMEOUT_MS = 30_000

const QUANTUM_FLAG_KEY = 'enable_quantum_accounts'

// Mint a real algo25 key in the in-memory keystore from the pinned
// mnemonic and register the matching account in the accounts store.
// Returns the populated account so callers can wire the send-funds
// store and assertions to the same address.
const seedAlgo25Sender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(keyResult).not.toBeNull()
    })

    const sender: WalletAccount = {
        id: 'sender-1',
        type: AccountTypes.algo25,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: keyResult!.seedKey.id ?? '',
        name: 'Sender',
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountAddress(sender.address)
    return sender
}

// Register a Quantum account directly in the store and select it. No KMS key
// or transaction submission is needed: the test only mounts the confirmation
// screen and reaches the fee row. `useSignerFor` resolves an own-key account
// to itself, so `isQuantumAccount(signer)` is true. Reusing
// ALGO25_TEST_ADDRESS lets the existing `mockAlgodAccountInformation` apply.
const seedQuantumSender = (): WalletAccount => {
    const sender: WalletAccount = {
        id: 'quantum-1',
        type: AccountTypes.quantum,
        address: ALGO25_TEST_ADDRESS,
        keyPairId: 'quantum-key-1',
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

describe('Flow: Send quantum-fee explainer on the confirmation screen', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        // The quantum feature flag is OFF by default in tests; clear any
        // per-test override so it does not leak into other suites.
        useRemoteConfigStore.getState().resetState()
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // Pin the active network to mainnet so useAssetsQuery reads the same
        // network the ALGO asset is seeded into. The default network is
        // env-driven (testnet in local dev), so without this the confirmation
        // screen never resolves its asset and stays on the loading gate.
        useNetworkStore.getState().setNetwork('mainnet')
        // Confirmation screen reads ALGO via useAssetsQuery — seed it first.
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        useRemoteConfigStore.getState().resetState()
        vi.mocked(Notifier.showNotification).mockClear()

        // Default algod / indexer responses sufficient for the confirmation
        // screen to settle (asset query + recipient-MBR check).
        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: ALGO25_TEST_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodAccountInformation({
                address: RECEIVER_ADDRESS,
                response: { amount: 5_000_000, 'min-balance': 100_000 },
            }),
            mockAlgodStatus({ response: { 'last-round': 100 } }),
            mockAlgodSendRawTransaction(),
            mockIndexerSearchForAccounts(),
        )
    })

    it(
        'Given the quantum flag is on and a quantum sender, when the confirmation screen settles, then the quantum-fee explainer renders in the fee row',
        async () => {
            // Enable the flag through the real remote-config override so the
            // whole useIsQuantumAccountsEnabled → useSignerFor chain is
            // exercised, not a mocked hook.
            useRemoteConfigStore
                .getState()
                .setConfigOverride(QUANTUM_FLAG_KEY, true)

            seedQuantumSender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            // The confirm button only mounts once isReady === true, so it is
            // the signal that the fee row has settled. No confirm click / no
            // signing needed for the explainer assertion.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('send_confirm_button'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            expect(
                await screen.findByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a standard algo25 sender, when the confirmation screen settles with the quantum flag on, then the quantum-fee explainer is absent',
        async () => {
            // Flag on to prove the account type — not the flag alone — gates
            // the explainer: a standard signer must never surface it.
            useRemoteConfigStore
                .getState()
                .setConfigOverride(QUANTUM_FLAG_KEY, true)

            await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            renderSendConfirmationStack()

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('send_confirm_button'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )

            expect(
                screen.queryByTestId(QUANTUM_FEE_EXPLAINER_TEST_ID),
            ).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
