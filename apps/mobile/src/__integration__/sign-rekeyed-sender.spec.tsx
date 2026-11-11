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
    seedQuantumSigner,
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

import { decodeSignedTransaction, generateAccount } from 'algosdk'
import { getProvider } from '@perawallet/wallet-extension-provider'
import type { SignedTransaction } from '@perawallet/wallet-core-chain-contract'
import { getSelectedScope } from '@perawallet/wallet-core-chain-shared'
import {
    toUnsignedAlgorandTransaction,
    withAlgorandAuthorizer,
} from '@perawallet/wallet-core-chain-algorand/signing'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'
import { registerFakeLedgerProvider } from './__fixtures__/ledger'
import { QUANTUM_TEST_ADDRESS } from './__fixtures__/quantum'

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
    name: '',
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

    // ARC-0001 `signers: [B]` for a sender the wallet doesn't hold (a dApp
    // escrow rekeyed to B). B is itself rekeyed to C, but the chain checks the
    // escrow's authority, so B's own key must sign: C's would be rejected.
    describe('a dApp naming a rekeyed account as the signer', () => {
        const ESCROW_ADDRESS = generateAccount().addr.toString()

        const buildNamedSignerRequest = (namedSigner: string) => {
            const transaction = buildPaymentTransaction({
                sender: ESCROW_ADDRESS,
                receiver: namedSigner,
            })
            return buildTransactionSignRequest({
                txs: [transaction],
                overrides: {
                    txs: [
                        withAlgorandAuthorizer(
                            toUnsignedAlgorandTransaction(
                                transaction,
                                getSelectedScope(ALGORAND_CHAIN_ID),
                            ),
                            namedSigner,
                        ),
                    ],
                    chainData: {
                        algorand: {
                            signerOverrides: new Map([[0, namedSigner]]),
                        },
                    },
                },
            })
        }

        const confirmAndReadSigned = async (
            built: ReturnType<typeof buildNamedSignerRequest>,
        ) => {
            const { confirm } = renderSignReview(built.request)
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
                    expect(built.approve).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(built.error).not.toHaveBeenCalled()
            const delivered = built.approve.mock
                .calls[0][0] as SignedTransaction[]
            return decodeSignedTransaction(delivered[0].bytes)
        }

        const spyOnKeystoreSign = () => {
            const signSpy = vi
                .spyOn(getProvider().key.store, 'sign')
                .mockResolvedValue(new Uint8Array(64).fill(7))
            onTestFinished(() => signSpy.mockRestore())
        }

        it('Given the named signer is rekeyed to a Ledger, when the user confirms, then the named signer signs with its own key and the Ledger is never asked', async () => {
            const namedSigner = await seedAlgo25Signer()
            useAccountsStore
                .getState()
                .setAccounts([namedSigner, ledgerAccount])
            seedAuthority(AUTH_ADDRESS, LEDGER_ADDRESS)
            spyOnKeystoreSign()

            const signed = await confirmAndReadSigned(
                buildNamedSignerRequest(AUTH_ADDRESS),
            )

            expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
            expect(signed.txn.sender.toString()).toBe(ESCROW_ADDRESS)
            expect(pendingSignature).toBeNull()
        })

        it('Given the named signer is rekeyed to a quantum account, when the user confirms, then no quantum warning shows and the named signer signs with its own key', async () => {
            await seedAlgo25Signer()
            await seedQuantumSigner()
            seedAuthority(AUTH_ADDRESS, QUANTUM_TEST_ADDRESS)
            spyOnKeystoreSign()

            const signed = await confirmAndReadSigned(
                buildNamedSignerRequest(AUTH_ADDRESS),
            )

            expect(signed.sgnr?.toString()).toBe(AUTH_ADDRESS)
            expect(signed.sig?.length).toBe(64)
        })

        it("Given the named signer's own key isn't in the wallet, then the review explains that and shows no confirm control", async () => {
            const authSigner = await seedAlgo25Signer()
            const namedSigner: WalletAccount = {
                id: 'named-signer',
                custody: { kind: 'watch' },
                chains: { algorand: { address: REKEYED_SENDER_ADDRESS } },
                name: 'Named signer',
            }
            seedAuthority(REKEYED_SENDER_ADDRESS, AUTH_ADDRESS)
            useAccountsStore.getState().setAccounts([namedSigner, authSigner])

            renderSignReview(
                buildNamedSignerRequest(REKEYED_SENDER_ADDRESS).request,
            )

            await waitFor(
                () => {
                    expect(
                        screen.getByText(
                            'signing.cannot_sign.signer_key_missing_body',
                        ),
                    ).toBeTruthy()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('signing-confirm-slide')).toBeNull()
        })
    })
})
