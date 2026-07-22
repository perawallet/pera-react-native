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

// LRK-022 cross-cutting coverage: no suite anywhere exercised a rekeyed
// sender through the interactive review, and none pinned the WC-facing
// device-reject contract. Both ride the real signing pipeline via the
// signing-review harness (callback transport = what the WC handler wires in).

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
    seedAlgo25Signer,
    fireEvent,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { LedgerUserRejectedError } from '@perawallet/wallet-core-ledger'
import {
    AccountTypes,
    useAccountsStore,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { getProvider } from '@perawallet/wallet-extension-provider'

import type { SignedTransaction } from 'algosdk'

const SLOW_TEST_TIMEOUT_MS = 30_000

// The rekeyed sender holds no key of its own — only the auth account can
// produce a signature, so a completed sign is itself proof of auth routing.
const REKEYED_SENDER_ADDRESS = REVIEW_RECEIVER_ADDRESS
const AUTH_ADDRESS = REVIEW_SIGNER_ADDRESS
const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS

type Deferred<T> = {
    promise: Promise<T>
    resolve: (value: T) => void
    reject: (error: Error) => void
}
const createDeferred = <T,>(): Deferred<T> => {
    let resolveFn!: (value: T) => void
    let rejectFn!: (error: Error) => void
    const promise = new Promise<T>((res, rej) => {
        resolveFn = res
        rejectFn = rej
    })
    return { promise, resolve: resolveFn, reject: rejectFn }
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

describe('Flow: interactive signing with a rekeyed sender / WC device reject', () => {
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
    })

    it(
        'Given a WC request whose sender is rekeyed to a held local key, when the user confirms, then the auth account signs and sgnr is stamped on the signed transaction',
        async () => {
            const authSigner = await seedAlgo25Signer()
            const rekeyedSender: WalletAccount = {
                id: 'rekeyed-sender',
                type: AccountTypes.watch,
                address: REKEYED_SENDER_ADDRESS,
                rekeyAddress: AUTH_ADDRESS,
                name: 'Rekeyed sender',
            }
            useAccountsStore.getState().setAccounts([rekeyedSender, authSigner])

            const { request, approve, error } = buildTransactionSignRequest({
                sourceType: 'walletconnect',
                txs: [
                    buildPaymentTransaction({
                        sender: REKEYED_SENDER_ADDRESS,
                        receiver: AUTH_ADDRESS,
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

            await waitFor(
                () => {
                    expect(approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(error).not.toHaveBeenCalled()

            const signedTxs = approve.mock.calls[0][0] as SignedTransaction[]
            expect(signedTxs).toHaveLength(1)
            const signed = signedTxs[0]
            // The auth-addr rule: signature from the auth key, sgnr stamped
            // so validators resolve the signer, sender untouched.
            expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
            expect(signed.txn.sender.toString()).toBe(REKEYED_SENDER_ADDRESS)
            expect(signed.sig?.length).toBe(64)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a WC request with a Ledger sender, when the device rejects and the user cancels, then the dApp receives the canonical rejection — never the error callback',
        async () => {
            // LRK-012 per-feature contract: the WC handler maps `reject` to
            // connector.rejectRequest (a proper dApp rejection) and `error`
            // to the failure path — a device reject must land on `reject`.
            useAccountsStore.getState().setAccounts([ledgerAccount])

            const { request, approve, reject, error } =
                buildTransactionSignRequest({
                    sourceType: 'walletconnect',
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

            await waitFor(
                () => {
                    expect(pendingSignature).not.toBeNull()
                },
                { timeout: 10_000 },
            )
            pendingSignature!.reject(new LedgerUserRejectedError())

            await waitFor(
                () => {
                    expect(
                        screen.getByText('ledger.signing.cancel'),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            fireEvent.click(screen.getByText('ledger.signing.cancel'))

            await waitFor(
                () => {
                    expect(reject).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(error).not.toHaveBeenCalled()
            expect(approve).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
