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

// A rekeyed sender through the interactive review, and the WC-facing
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
    onTestFinished,
    vi,
} from 'vitest'

import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { seedAuthority } from '@test-utils/algorandAccountsAdapter'
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
    drainPendingSignRequests,
    fireEvent,
    screen,
    waitFor,
    REVIEW_SIGNER_ADDRESS,
    REVIEW_RECEIVER_ADDRESS,
} from '@test-utils/signing-review'
import { LedgerUserRejectedError } from '@perawallet/wallet-core-ledger'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type HardwareWalletAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

import { decodeSignedTransaction } from 'algosdk'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'

// The rekeyed sender holds no key of its own — only the auth account can
// produce a signature, so a completed sign is itself proof of auth routing.
const REKEYED_SENDER_ADDRESS = REVIEW_RECEIVER_ADDRESS
const AUTH_ADDRESS = REVIEW_SIGNER_ADDRESS
const LEDGER_ADDRESS = REVIEW_RECEIVER_ADDRESS

let pendingSignature: PromiseWithResolvers<Uint8Array> | null = null

const blockOnSignature = (): Promise<Uint8Array> => {
    pendingSignature = Promise.withResolvers<Uint8Array>()
    return pendingSignature.promise
}

const ledgerAccount: HardwareWalletAccount = {
    id: 'hw-ledger-1',
    custody: {
        kind: 'hardware',
        device: {
            manufacturer: 'ledger',
            deviceId: 'test-device-id',
            deviceName: 'Ledger Nano X',
            transportType: 'ble',
        },
        accountIndex: 0,
    },
    chains: { algorand: { address: LEDGER_ADDRESS } },
}

describe('Flow: interactive signing with a rekeyed sender / WC device reject', () => {
    beforeAll(async () => {
        await setupTestDatabase()
        registerFakeLedgerProvider({
            address: LEDGER_ADDRESS,
            signTransaction: blockOnSignature,
        })
    })
    afterEach(() => {
        pendingSignature = null
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        drainPendingSignRequests()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
    })

    it('Given a WC request whose sender is rekeyed to a held local key, when the user confirms, then the auth account signs and sgnr is stamped on the signed transaction', async () => {
        const authSigner = await seedAlgo25Signer()
        const rekeyedSender: WalletAccount = {
            id: 'rekeyed-sender',
            custody: { kind: 'watch' },
            chains: { algorand: { address: REKEYED_SENDER_ADDRESS } },
            name: 'Rekeyed sender',
        }
        seedAuthority(REKEYED_SENDER_ADDRESS, AUTH_ADDRESS)
        useAccountsStore.getState().setAccounts([rekeyedSender, authSigner])
        // The in-memory keystore signs with 64 zero bytes, which the
        // canonical encoding drops; a visible signature survives delivery.
        const signSpy = vi
            .spyOn(getProvider().key.store, 'sign')
            .mockResolvedValue(new Uint8Array(64).fill(7))
        onTestFinished(() => signSpy.mockRestore())

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
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
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

        const delivered = approve.mock.calls[0][0] as SignedTransaction[]
        expect(delivered).toHaveLength(1)
        const signed = decodeSignedTransaction(delivered[0].bytes)
        // The auth-addr rule: signature from the auth key, sgnr stamped
        // so validators resolve the signer, sender untouched.
        expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
        expect(signed.txn.sender.toString()).toBe(REKEYED_SENDER_ADDRESS)
        expect(signed.sig?.length).toBe(64)
    })

    it('Given a WC request with a Ledger sender, when the device rejects and the user cancels, then the dApp receives the canonical rejection — never the error callback', async () => {
        // The WC handler maps `reject` to
        // connector.rejectRequest (a proper dApp rejection) and `error`
        // to the failure path — a device reject must land on `reject`.
        useAccountsStore.getState().setAccounts([ledgerAccount])

        const { request, approve, reject, error } = buildTransactionSignRequest(
            {
                sourceType: 'walletconnect',
                txs: [
                    buildPaymentTransaction({
                        sender: LEDGER_ADDRESS,
                        receiver: REVIEW_SIGNER_ADDRESS,
                    }),
                ],
            },
        )

        const { confirm } = renderSignReview(request)

        await waitFor(
            () => {
                expect(screen.getByTestId('signing-confirm-slide')).toBeTruthy()
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
                expect(screen.getByText('ledger.signing.cancel')).toBeTruthy()
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
    })

    it('Given a WC request whose sender is rekeyed to an auth account the wallet does not hold, then the review shows the auth-missing explanation instead of the confirm control', async () => {
        const rekeyedSender: WalletAccount = {
            id: 'rekeyed-sender',
            custody: { kind: 'watch' },
            chains: { algorand: { address: REKEYED_SENDER_ADDRESS } },
            name: 'Rekeyed sender',
        }
        seedAuthority(REKEYED_SENDER_ADDRESS, AUTH_ADDRESS)
        useAccountsStore.getState().setAccounts([rekeyedSender])

        const { request } = buildTransactionSignRequest({
            sourceType: 'walletconnect',
            txs: [
                buildPaymentTransaction({
                    sender: REKEYED_SENDER_ADDRESS,
                    receiver: AUTH_ADDRESS,
                }),
            ],
        })

        renderSignReview(request)

        await waitFor(
            () => {
                expect(
                    screen.getByText(
                        'signing.cannot_sign.rekeyed_auth_missing_body',
                    ),
                ).toBeTruthy()
            },
            { timeout: 10_000 },
        )
        expect(screen.queryByTestId('signing-confirm-slide')).toBeNull()
    })
})
