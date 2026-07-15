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

// Phase 3 — hardware (Ledger) signing through the review sheet. SigningOverlays
// includes the Ledger driver, so confirming an external transaction with a
// Ledger signer surfaces the awaiting-approval overlay; releasing the device
// signature completes signing and delivers via the callback transport.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'

import { server } from '@test-utils/msw-server'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    buildPaymentTransaction,
    buildTransactionSignRequest,
    renderSignReview,
    screen,
    waitFor,
    REVIEW_RECEIVER_ADDRESS,
    REVIEW_SIGNER_ADDRESS,
} from '@test-utils/signing-review'
import {
    AccountTypes,
    useAccountsStore,
    type HardwareWalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The Ledger account is the transaction sender; the fake transport's
// getAddress echoes the same address so connection verification passes.
const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }
const createDeferred = <T,>(): Deferred<T> => {
    let resolveFn!: (value: T) => void
    const promise = new Promise<T>(res => {
        resolveFn = res
    })
    return { promise, resolve: resolveFn }
}

let pendingSignature: Deferred<Uint8Array> | null = null

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

const ledgerAccount: HardwareWalletAccount = {
    id: 'hw-ledger-1',
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

describe('Flow: hardware (Ledger) signing review', () => {
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
        useAccountsStore.getState().setAccounts([ledgerAccount])
    })

    it(
        'surfaces the awaiting-approval overlay on confirm and delivers once the device signs',
        async () => {
            const { request, approve } = buildTransactionSignRequest({
                sourceType: 'webview',
                txs: [
                    buildPaymentTransaction({
                        sender: LEDGER_ADDRESS,
                        receiver: REVIEW_SIGNER_ADDRESS,
                    }),
                ],
            })

            const { confirm } = renderSignReview(request)

            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('signing-confirm-slide'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            confirm()

            // The Ledger awaiting-approval overlay surfaces via the
            // SigningOverlays driver while the device confirmation is pending.
            await waitFor(
                () => {
                    expect(
                        screen.getByTestId('ledger-signing-overlay-lottie'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            expect(approve).not.toHaveBeenCalled()

            // Release the device signature → signing completes and the result
            // is delivered to the callback transport.
            expect(pendingSignature).not.toBeNull()
            pendingSignature!.resolve(new Uint8Array(64))

            await waitFor(
                () => {
                    expect(approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
