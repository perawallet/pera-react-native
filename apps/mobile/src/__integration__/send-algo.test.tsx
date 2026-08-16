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
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react'
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
import { useKMS, type Algo25KeyResult } from '@perawallet/wallet-core-kms'

import { useSendFundsStore } from '@modules/transactions/hooks/send-funds/useSendFunds'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/screens/send-funds/TransactionSuccessScreen/TransactionSuccessScreen'
import {
    mockAlgodAccountInformation,
    mockAlgodPendingTransaction,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-blockchain/test-handlers'

import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS

const SLOW_TEST_TIMEOUT_MS = 30_000

// Mint a real algo25 key in the in-memory keystore from the pinned
// mnemonic and register the matching account in the accounts store.
// Returns the populated account so callers can wire the send-funds
// store and assertions to the same address.
const seedAlgo25Sender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await waitFor(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonic: ALGO25_TEST_MNEMONIC,
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

describe('Flow: Send ALGO end-to-end (Confirmation → Processing → Success)', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'warn' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // Confirmation/processing screens read ALGO via useAssetsQuery —
        // seed it before each test.
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()

        // Default algod / indexer responses sufficient for the
        // build-and-submit pipeline plus the confirmation screen's
        // recipient-MBR check.
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
        'Given a pre-filled send-funds store, when the user taps the confirm button, then the pipeline signs locally, POSTs to algod, and the success screen renders',
        async () => {
            const sender = await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // Spy on the submission so we can prove the pipeline reached
            // algod with a signed transaction.
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

            // Confirmation screen waits on useAssetsQuery + recipient
            // info. The confirm button only mounts once isReady === true.
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
                // Recipient-info pending disables the button until algod
                // returns the recipient's balance/min-balance.
                expect(confirmButton.disabled).toBe(false)
            })

            fireEvent.click(confirmButton)

            // Processing screen kicks off the send pipeline in a
            // useEffect — wait for the success screen to render.
            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Algod POST happened with the signed, grouped transaction.
            expect(sendSpy).toHaveBeenCalled()

            // Sender state survived the screen transitions.
            expect(useAccountsStore.getState().selectedAccountAddress).toBe(
                sender.address,
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the confirmation screen is mounted with no destination, when the user taps confirm, then an error toast is raised and submission does not happen',
        async () => {
            await seedAlgo25Sender()
            // Intentionally no destination.
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setSendMode('normal')

            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'irrelevant' }, { status: 200 }),
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

            fireEvent.click(screen.getByTestId('send_confirm_button'))

            // Confirmation screen short-circuits with a toast — algod
            // never gets touched.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 5000 },
            )
            expect(sendSpy).not.toHaveBeenCalled()
            // Still on the confirmation screen.
            expect(screen.queryByTestId('send_confirm_button')).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a rekeyed sender whose auth account holds the signing key, when the user confirms the send, then the pipeline resolves the auth account, signs with its key, and submits to algod',
        async () => {
            // Build a rekeyed pair: account A (the sender, no signing
            // key of its own — its auth-addr points at B) and account
            // B (algo25, holds the real key in the keystore). The
            // signing pipeline must walk A → B via `resolveAuthAccount`
            // and sign with B's keypair, otherwise the build+sign
            // chain throws CannotSignError before algod is hit.
            const { result: kms } = renderHook(() => useKMS())
            let authKey: Algo25KeyResult | null = null
            await waitFor(async () => {
                authKey = await kms.current.createAlgo25Key({
                    mnemonic: ALGO25_TEST_MNEMONIC,
                })
                expect(authKey).not.toBeNull()
            })
            const authAccount: WalletAccount = {
                id: 'auth-1',
                type: AccountTypes.algo25,
                address: ALGO25_TEST_ADDRESS,
                keyPairId: authKey!.seedKey.id ?? '',
                name: 'Auth (signer)',
            }
            // The rekeyed account has no signing key of its own —
            // `keyPairId` is omitted on purpose. The wallet relies on
            // `rekeyAddress` to find the actual signer at sign time.
            const rekeyedAccount: WalletAccount = {
                id: 'rekeyed-1',
                type: AccountTypes.algo25,
                address: HD_TEST_ADDRESS,
                keyPairId: '',
                name: 'Rekeyed sender',
                rekeyAddress: authAccount.address,
            }
            useAccountsStore
                .getState()
                .setAccounts([rekeyedAccount, authAccount])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(rekeyedAccount.address)

            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(ALGO25_TEST_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // Override algod's account info for the rekeyed sender so
            // it reports the same `auth-addr` the wallet has on the
            // local account. `fetchAndPersistAccount` reads this on
            // every refresh and writes it back into
            // `account.rekeyAddress` — without it, the wallet's
            // local rekey state gets cleared mid-send and the signing
            // pipeline fails to resolve an auth account.
            server.use(
                mockAlgodAccountInformation({
                    address: rekeyedAccount.address,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 100_000,
                        'auth-addr': authAccount.address,
                    },
                }),
                // Receiver = the auth address itself in this scenario;
                // shape stays the same as the happy-path test.
                mockAlgodAccountInformation({
                    address: ALGO25_TEST_ADDRESS,
                    response: { amount: 5_000_000, 'min-balance': 100_000 },
                }),
            )

            const sendSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        txId: 'REKEYTXID000000000000000000000000000000000000000000000',
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

            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 10_000 },
            )

            // Algod received the signed payload. Reaching this branch
            // is the load-bearing assertion: the signing strategy
            // must have resolved A → B and produced a valid
            // signature. Without the auth-account walk, the pipeline
            // throws CannotSignError and we never see the success
            // screen.
            expect(sendSpy).toHaveBeenCalled()
            // `vi.fn(() => ...)` infers the call args as `[]`; cast
            // the whole calls array to the MSW handler shape that the
            // runtime actually invokes the spy with.
            const calls = sendSpy.mock.calls as unknown as Array<
                [{ request: Request }]
            >
            const body = await calls[0][0].request.arrayBuffer()
            expect(body.byteLength).toBeGreaterThan(50)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given valid send params, when algod rejects the submission, then the processing screen surfaces an error toast, navigates back to confirmation, and never reaches success',
        async () => {
            await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // There is no client-side spendable-balance gate on the
            // confirmation → processing stack (that lives upstream on the
            // amount-input screen). The faithful failure here is algod
            // rejecting the submitted group — e.g. overspend / insufficient
            // balance at the node. The signing pipeline's submit step throws,
            // `useTransactionSendFlow.execute()` rejects, and the processing
            // screen's catch raises an error toast then navigates back.
            const rejectSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        message:
                            'TransactionPool.Remember: transaction ABC: overspend',
                    },
                    { status: 400 },
                ),
            )
            server.use(http.post('*/v2/transactions', rejectSpy))

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

            // The submission was attempted (the pipeline signed and POSTed)
            // but algod rejected it.
            await waitFor(
                () => {
                    expect(rejectSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            // Error surfaced as a toast and the flow returned to the
            // confirmation screen — success never rendered.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(screen.queryByTestId('PWResultView')).toBeNull()
            await waitFor(() => {
                expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given valid send params, when the submission fails with a network error, then the processing screen surfaces an error toast and returns to confirmation without reaching success',
        async () => {
            await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // A transport-level failure on the submit POST (dropped
            // connection, DNS, etc). The headless callback pipeline does not
            // auto-retry — it rejects through the request's `error` callback —
            // so the processing screen catches and surfaces the error rather
            // than silently retrying.
            const failSpy = vi.fn(() => HttpResponse.error())
            server.use(http.post('*/v2/transactions', failSpy))

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

            await waitFor(
                () => {
                    expect(failSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            // The baseline pending-transaction mock 404s, so the post-error
            // landing verification comes up empty. The surfaced copy must be
            // the honest "status unknown" message — not "failed" and not
            // plain "no connection" — because the transaction may still have
            // landed (PERA-4896).
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalledWith(
                        expect.objectContaining({
                            title: 'errors.submission.unknown_outcome.title',
                        }),
                    )
                },
                { timeout: 15_000 },
            )
            expect(screen.queryByTestId('PWResultView')).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given valid send params, when the submit response is lost but the transaction landed on-chain, then the success screen renders instead of a failure (PERA-4896)',
        async () => {
            await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // The reported field bug: the POST never gets a response (flaky
            // mobile connection) but the node received the bytes — the
            // transaction confirmed two rounds later while the app claimed
            // failure. The pipeline must verify the locally derived txid
            // against the chain and resolve as success.
            const failSpy = vi.fn(() => HttpResponse.error())
            server.use(
                http.post('*/v2/transactions', failSpy),
                mockAlgodPendingTransaction({
                    response: { 'confirmed-round': 101 },
                    status: 200,
                }),
            )

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

            await waitFor(
                () => {
                    expect(failSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )

            // Success, not an error toast: the chain says the transaction
            // is confirmed even though the submit call errored.
            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 15_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given valid send params, when algod answers "transaction already in ledger", then the send resolves as success (PERA-4896)',
        async () => {
            await seedAlgo25Sender()
            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // A duplicate rejection is proof of success — typically a retry
            // after a lost response. It must never surface as a failure.
            const duplicateSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        message: `TransactionPool.Remember: transaction already in ledger: ${'A'.repeat(52)}`,
                    },
                    { status: 400 },
                ),
            )
            server.use(http.post('*/v2/transactions', duplicateSpy))

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

            await waitFor(
                () => {
                    expect(duplicateSpy).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            await waitFor(
                () => {
                    expect(screen.getByTestId('send_success')).toBeTruthy()
                },
                { timeout: 10_000 },
            )
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    // Kept last on purpose. A missing auth account fails inside the local-key
    // signer's auth-resolution step; that failure path leaves the signing
    // lifecycle's module-scoped actor registry occupied, and the single-flight
    // queue guard then blocks any request a *subsequent* test enqueues. The
    // registry has no barrel-exported reset, so ordering this case last is the
    // only in-test way to keep it from poisoning the others.
    it(
        'Given a rekeyed sender whose auth account is missing from the wallet, when the user confirms the send, then the pipeline rejects (no algod POST) and an error is surfaced',
        async () => {
            // Same shape as the happy-path rekey case, but the auth
            // account is intentionally NOT registered in the
            // accounts store. `resolveAuthAccount` will throw
            // RekeyTargetNotFoundError before any signing happens —
            // surfaced as a toast, no algod traffic.
            const rekeyedAccount: WalletAccount = {
                id: 'rekeyed-orphan',
                type: AccountTypes.algo25,
                address: HD_TEST_ADDRESS,
                keyPairId: '',
                name: 'Rekeyed sender (orphan)',
                rekeyAddress: ALGO25_TEST_ADDRESS,
            }
            useAccountsStore.getState().setAccounts([rekeyedAccount])
            useAccountsStore
                .getState()
                .setSelectedAccountAddress(rekeyedAccount.address)

            useSendFundsStore.getState().setSelectedAssetId(ALGO_ASSET_ID)
            useSendFundsStore.getState().setAmount(new Decimal(1))
            useSendFundsStore.getState().setDestination(ALGO25_TEST_ADDRESS)
            useSendFundsStore.getState().setSendMode('normal')

            // The chain still reports the rekey, but the wallet has
            // no key for the auth address — the failure mode under
            // test is "auth account is missing from the wallet", not
            // "chain disagrees with the wallet about the rekey."
            server.use(
                mockAlgodAccountInformation({
                    address: rekeyedAccount.address,
                    response: {
                        amount: 5_000_000,
                        'min-balance': 100_000,
                        'auth-addr': ALGO25_TEST_ADDRESS,
                    },
                }),
            )

            const sendSpy = vi.fn(() =>
                HttpResponse.json({ txId: 'unused' }, { status: 200 }),
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

            // The signing pipeline rejects before the algod POST.
            // Surface mechanism is a toast; assert it fired AND that
            // no /v2/transactions POST was made. Together these prove
            // the rejection happened at the auth-resolution layer,
            // not somewhere downstream.
            await waitFor(
                () => {
                    expect(
                        vi.mocked(Notifier.showNotification),
                    ).toHaveBeenCalled()
                },
                { timeout: 10_000 },
            )
            expect(sendSpy).not.toHaveBeenCalled()
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
