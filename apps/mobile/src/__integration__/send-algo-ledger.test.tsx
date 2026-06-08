/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Decimal } from 'decimal.js'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

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
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import { useLedgerSigningDriver } from '@modules/signing/components/SigningOverlays/useLedgerSigningDriver'
import {
    mockAlgodAccountInformation,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

// The Ledger sender reuses the same valid fixture address that the other
// ledger integration tests pin (HD_TEST_ADDRESS). The receiver is a
// distinct valid Algorand address so we exercise an actual A → B payment.
const LEDGER_ADDRESS = HD_TEST_ADDRESS
const RECEIVER_ADDRESS = ALGO25_TEST_ADDRESS

const SLOW_TEST_TIMEOUT_MS = 30_000

type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
}

const createDeferred = <T,>(): Deferred<T> => {
    let resolveFn!: (value: T) => void
    const promise = new Promise<T>(res => {
        resolveFn = res
    })
    return { promise, resolve: resolveFn }
}

// Module-scoped so the per-call deferred outlives the closure that
// `signTransaction` returns from — the test thread reaches into this
// to release the signing pipeline AFTER asserting the awaiting UI.
let pendingSignature: Deferred<Uint8Array> | null = null

/**
 * Register a Ledger BLE transport stub whose `signTransaction` blocks on a
 * module-scoped deferred promise. This lets the test observe the
 * awaiting-approval phase rendered inline by TransactionProcessingScreen
 * BEFORE releasing the signature and letting the pipeline submit to algod.
 */
const registerFakeLedgerProvider = () => {
    getProvider().hardwareWalletRegistry.register({
        manufacturer: 'ledger',
        transportType: 'ble',
        scan: () => () => {},
        connect: async () => ({
            getAddress: async (accountIndex: number) => ({
                address: LEDGER_ADDRESS,
                publicKey: new Uint8Array(32),
                accountIndex,
            }),
            signTransaction: async () => {
                pendingSignature = createDeferred<Uint8Array>()
                return pendingSignature.promise
            },
            signData: async () => new Uint8Array(64),
            getAppVersion: async () => ({ major: 0, minor: 0, patch: 0 }),
            disconnect: async () => {},
        }),
        isSupported: async () => false,
    })
}

const seedLedgerSender = (): HardwareWalletAccount => {
    const sender: HardwareWalletAccount = {
        type: AccountTypes.hardware,
        address: LEDGER_ADDRESS,
        hardwareDetails: {
            manufacturer: 'ledger',
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            accountIndex: 0,
            transportType: 'ble',
        },
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountAddress(sender.address)
    return sender
}

/**
 * Test-only mount of the LedgerSigningDriver so the LedgerSigningContent
 * bottom sheet actually opens during integration tests. In production this
 * is one of the hooks called by `SigningOverlays` at the root of the app
 * (`RootComponent.tsx`); the test harness `renderWithNavigation` mounts
 * the `BottomSheetManager` but not the overlays, so we wire just the
 * driver here.
 */
const LedgerDriverHost = () => {
    useLedgerSigningDriver()
    return null
}

const renderSendConfirmationStack = () =>
    renderWithNavigation(
        wrapWithLedgerDriver(TransactionConfirmationScreen),
        'ConfirmTransaction',
        {
            additionalScreens: [
                {
                    name: 'TransactionProcessing',
                    component: wrapWithLedgerDriver(
                        TransactionProcessingScreen,
                    ),
                },
                {
                    name: 'TransactionSuccess',
                    component: TransactionSuccessScreen,
                },
            ],
        },
    )

// Mount the driver alongside each signing-adjacent screen so the bottom
// sheet stays subscribed for the duration of the flow (the driver only
// runs while its hosting component is mounted, and screens unmount on
// navigation in the test stack).
const wrapWithLedgerDriver = <P extends object>(
    Component: React.ComponentType<P>,
): React.ComponentType<P> => {
    const Wrapped = (props: P) => (
        <>
            <LedgerDriverHost />
            <Component {...props} />
        </>
    )
    Wrapped.displayName = `WithLedgerDriver(${Component.displayName ?? Component.name})`
    return Wrapped
}

describe('Flow: Send ALGO from a Ledger account (Confirmation → Awaiting Approval → Success)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
        registerFakeLedgerProvider()
    })
    afterEach(() => {
        server.resetHandlers()
        pendingSignature = null
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()

        server.use(
            mockAlgodTransactionParams({ response: { fee: 1000 } }),
            mockAlgodAccountInformation({
                address: LEDGER_ADDRESS,
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
        'Given a Ledger sender, when the user confirms, then the LedgerAwaitingApprovalContent surfaces via the SigningOverlays driver until the device signs',
        async () => {
            const sender = seedLedgerSender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // Spy on the submission so we can assert the pipeline only POSTs
            // AFTER the deferred Ledger signature resolves.
            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'TESTTXID0000000000000000000000000000000000000000000000',
                    },
                    { status: 200 },
                ),
            )
            server.use(http.post('*/v2/transactions', sendSpy))

            renderSendConfirmationStack()

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('send_confirm_button'),
                    ).toBeTruthy()
                },
                { timeout: 5000 },
            )
            const confirmButton = screen.getByTestId(
                'send_confirm_button',
            ) as HTMLButtonElement
            await waitFor(() => {
                expect(confirmButton.disabled).toBe(false)
            })

            fireEvent.click(confirmButton)

            // The critical assertion: the awaiting-approval phase surfaces
            // the LedgerAwaitingApprovalContent via the SigningOverlays
            // bottom sheet driver. The Lottie testID is the visible signal
            // that the user is seeing Ledger UI (not just the generic
            // "Sending the transaction" Lottie).
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('ledger-signing-overlay-lottie'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Algod must NOT have been hit yet — we're paused at the
            // (deferred) device-confirm step.
            expect(sendSpy).not.toHaveBeenCalled()

            // Release the deferred Ledger signature so the pipeline can
            // finish encoding, POST to algod, and navigate to success.
            expect(pendingSignature).not.toBeNull()
            pendingSignature!.resolve(new Uint8Array(64))

            await waitFor(
                () => {
                    expect(screen.getByTestId('PWResultView')).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            expect(sendSpy).toHaveBeenCalled()

            // Selected account state survived the transitions.
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                sender.address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
