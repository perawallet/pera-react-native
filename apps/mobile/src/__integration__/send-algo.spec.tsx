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
    onTestFinished,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'
import { useNavigation } from '@react-navigation/native'

import { server } from '@test-utils/msw-server'
import { seedAuthority } from '@test-utils/algorandAccountsAdapter'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    useAccountChainStateStore,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    KeyNotFoundError,
    useKMS,
    type Algo25KeyResult,
} from '@perawallet/wallet-core-kms'

import { useSendFundsStore } from '@modules/transactions'
import { TransactionConfirmationScreen } from '@modules/transactions/screens/send-funds/TransactionConfirmationScreen/TransactionConfirmationScreen'
import { TransactionProcessingScreen } from '@modules/transactions/screens/send-funds/TransactionProcessingScreen/TransactionProcessingScreen'
import { TransactionSuccessScreen } from '@modules/transactions/routes'
import { AddContactScreen } from '@modules/contacts/routes'
import {
    mockAlgodAccountInformation,
    mockAlgodPendingTransaction,
    mockAlgodSendRawTransaction,
    mockAlgodStatus,
    mockAlgodTransactionParams,
    mockIndexerSearchForAccounts,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'

import { isElementDisabled, findEnabledByTestId } from '@test-utils/rnw'
import {
    ALGO25_TEST_ADDRESS,
    ALGO25_TEST_MNEMONIC_INDICES,
    HD_TEST_ADDRESS,
} from './__fixtures__/onboarding'
import { addressOf, keyPairIdOf } from './__fixtures__/accounts'
import {
    recordAnalyticsEvents,
    type AnalyticsRecorder,
} from '@test-utils/analytics-recorder'
import { expectFlowEvents } from './__fixtures__/analytics-flows'

const NATIVE_ASSET_ID = '0'

const RECEIVER_ADDRESS = HD_TEST_ADDRESS

// Mint a real algo25 key in the in-memory keystore from the pinned
// mnemonic and register the matching account in the accounts store.
// Returns the populated account so callers can wire the send-funds
// store and assertions to the same address.
const seedAlgo25Sender = async (): Promise<WalletAccount> => {
    const { result: kms } = renderHook(() => useKMS())
    let keyResult: Algo25KeyResult | null = null
    await act(async () => {
        keyResult = await kms.current.createAlgo25Key({
            mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
        })
        expect(keyResult).not.toBeNull()
    })

    const sender: WalletAccount = {
        id: 'sender-1',
        custody: { kind: 'local', seed: null },
        chains: {
            algorand: {
                address: ALGO25_TEST_ADDRESS,
                keyPairId: keyResult!.seedKey.id ?? '',
            },
        },
        name: 'Sender',
    }
    useAccountsStore.getState().setAccounts([sender])
    useAccountsStore.getState().setSelectedAccountId(sender.id)
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
    let analytics: AnalyticsRecorder
    beforeEach(() => {
        analytics = recordAnalyticsEvents()
    })
    afterEach(() => {
        analytics.restore()
    })

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        // Confirmation/processing screens read ALGO via useAssetsQuery —
        // seed it before each test.
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useAccountChainStateStore.getState().resetState()
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

    it('Given an Algorand send, when the user reviews it, then the review shows the network chip and the network badge on both avatars', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')

        renderSendConfirmationStack()

        const chip = await screen.findByTestId('send_confirm_network')
        expect(chip.textContent).toContain('Algorand')
        expect(
            screen.getAllByTestId('chain_avatar_badge_algorand'),
        ).toHaveLength(2)
    })

    it('Given a pre-filled send-funds store, when the user taps the confirm button, then the pipeline signs locally, POSTs to algod, and the success screen renders', async () => {
        const sender = await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
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
        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
        expect(screen.getByText('send_funds.success.title')).toBeTruthy()
        expect(
            screen.getByText('send_funds.success.view_in_explorer'),
        ).toBeTruthy()

        // Algod POST happened with the signed, grouped transaction.
        expect(sendSpy).toHaveBeenCalled()

        // Sender state survived the screen transitions.
        expect(useAccountsStore.getState().selectedAccountId).toBe(sender.id)
        expectFlowEvents(analytics, 'send', 'algorand')
    })

    it('Given the recipient-info lookup is still in flight, when the confirmation screen mounts, then the confirm button is disabled but not in the loading state', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')

        // Hold the recipient lookup open so its pending window is
        // observable; on release the resolver returns undefined, which
        // falls through to the default receiver handler from beforeEach.
        let releaseRecipientInfo!: () => void
        const recipientInfoGate = new Promise<void>(resolve => {
            releaseRecipientInfo = resolve
        })
        server.use(
            http.get(`*/v2/accounts/${RECEIVER_ADDRESS}`, async () => {
                await recipientInfoGate
                return undefined
            }),
        )

        renderSendConfirmationStack()

        await waitFor(
            () => {
                expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
            },
            { timeout: 5000 },
        )

        // The pending lookup blocks interaction, but must not put the
        // button into the yellow in-flight phase — that phase renders
        // instantly on mount and caused the cold-start loading flash.
        const confirmButton = screen.getByTestId(
            'send_confirm_button',
        ) as HTMLButtonElement
        expect(isElementDisabled(confirmButton)).toBe(true)
        expect(confirmButton.getAttribute('data-loading')).toBe('false')

        releaseRecipientInfo()

        const enabledButton = await findEnabledByTestId('send_confirm_button')
        expect(enabledButton.getAttribute('data-loading')).toBe('false')
    })

    it('Given the confirmation screen is mounted with no destination, when the user taps confirm, then an error toast is raised and submission does not happen', async () => {
        await seedAlgo25Sender()
        // Intentionally no destination.
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setSendMode('normal')

        const sendSpy = vi.fn(() =>
            HttpResponse.json({ txId: 'irrelevant' }, { status: 200 }),
        )
        server.use(http.post('*/v2/transactions', sendSpy))

        renderSendConfirmationStack()

        await waitFor(
            () => {
                expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
            },
            { timeout: 5000 },
        )

        fireEvent.click(screen.getByTestId('send_confirm_button'))

        // Confirmation screen short-circuits with a toast — algod
        // never gets touched.
        await waitFor(
            () => {
                expect(vi.mocked(Notifier.showNotification)).toHaveBeenCalled()
            },
            { timeout: 5000 },
        )
        expect(sendSpy).not.toHaveBeenCalled()
        // Still on the confirmation screen.
        expect(screen.queryByTestId('send_confirm_button')).toBeTruthy()
    })

    it('Given a rekeyed sender whose auth account holds the signing key, when the user confirms the send, then the pipeline resolves the auth account, signs with its key, and submits to algod', async () => {
        // Build a rekeyed pair: account A (the sender, no signing
        // key of its own — its auth-addr points at B) and account
        // B (algo25, holds the real key in the keystore). The
        // signing pipeline must walk A → B via `resolveAuthAccount`
        // and sign with B's keypair, otherwise the build+sign
        // chain throws CannotSignError before algod is hit.
        const { result: kms } = renderHook(() => useKMS())
        let authKey: Algo25KeyResult | null = null
        await act(async () => {
            authKey = await kms.current.createAlgo25Key({
                mnemonicIndices: ALGO25_TEST_MNEMONIC_INDICES,
            })
            expect(authKey).not.toBeNull()
        })
        const authAccount: WalletAccount = {
            id: 'auth-1',
            custody: { kind: 'local', seed: null },
            chains: {
                algorand: {
                    address: ALGO25_TEST_ADDRESS,
                    keyPairId: authKey!.seedKey.id ?? '',
                },
            },
            name: 'Auth (signer)',
        }
        // The rekeyed account has no signing key of its own —
        // `keyPairId` is omitted on purpose. The wallet relies on the
        // recorded authority to find the actual signer at sign time.
        const rekeyedAccount: WalletAccount = {
            id: 'rekeyed-1',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: HD_TEST_ADDRESS } },
            name: 'Rekeyed sender',
        }
        seedAuthority(addressOf(rekeyedAccount), addressOf(authAccount))
        useAccountsStore.getState().setAccounts([rekeyedAccount, authAccount])
        useAccountsStore.getState().setSelectedAccountId(rekeyedAccount.id)

        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(ALGO25_TEST_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')

        // Override algod's account info for the rekeyed sender so
        // it reports the same `auth-addr` the wallet has on the
        // local account. `fetchAndPersistAccount` reads this on
        // every refresh and writes it back into the account's
        // synced authority — without it, the wallet's local rekey
        // state gets cleared mid-send and the signing pipeline
        // fails to resolve an auth account.
        server.use(
            mockAlgodAccountInformation({
                address: addressOf(rekeyedAccount),
                response: {
                    amount: 5_000_000,
                    'min-balance': 100_000,
                    'auth-addr': addressOf(authAccount),
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

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
    })

    it('Given valid send params, when algod rejects the submission, then the processing screen surfaces an error toast, navigates back to confirmation, and never reaches success', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
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

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
                expect(vi.mocked(Notifier.showNotification)).toHaveBeenCalled()
            },
            { timeout: 10_000 },
        )
        expect(screen.queryByTestId('pw-result-view')).toBeNull()
        await waitFor(() => {
            expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
        })
    })

    it('Given valid send params, when the submission fails with a network error, then the processing screen surfaces an error toast and returns to confirmation without reaching success', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
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

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
        // landed.
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
        expect(screen.queryByTestId('pw-result-view')).toBeNull()
    })

    it('Given valid send params, when the submit response is lost but the transaction landed on-chain, then the success screen renders instead of a failure', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
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

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
    })

    it('Given valid send params, when algod answers "transaction already in ledger", then the send resolves as success', async () => {
        await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')

        // A duplicate rejection is proof of success — typically a retry
        // after a lost response. It must never surface as a failure.
        const duplicateSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    message: `TransactionPool.Remember: transaction already in ledger: ${'A'.repeat(
                        52,
                    )}`,
                },
                { status: 400 },
            ),
        )
        server.use(http.post('*/v2/transactions', duplicateSpy))

        renderSendConfirmationStack()

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
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
    })

    it('Given the keystore reports the signing key missing, when the user confirms the send, then the toast carries the KMS copy, nothing is submitted, and the flow returns to Confirm', async () => {
        const sender = await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')
        // The seed resolves (View Passphrase works) but the child's
        // signing material does not — the on-device shape this guards.
        const signSpy = vi
            .spyOn(getProvider().key.store, 'sign')
            .mockRejectedValue(
                new KeyNotFoundError(keyPairIdOf(sender) ?? 'child'),
            )
        onTestFinished(() => signSpy.mockRestore())
        const sendSpy = vi.fn(() =>
            HttpResponse.json({ txId: 'UNREACHED' }, { status: 200 }),
        )
        server.use(http.post('*/v2/transactions', sendSpy))

        renderSendConfirmationStack()
        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
        })
        fireEvent.click(confirmButton)

        // Notifier is captured with raw i18n keys: showNotification receives
        // the key, and the Notifier component translates it. Matched with
        // stringContaining because a debug-enabled env (DEBUG_ENABLED=true
        // in the local .env) appends "\n\nDebug: <raw error>" to the body.
        await waitFor(
            () => {
                expect(
                    vi.mocked(Notifier.showNotification),
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'errors.signing.title',
                        description: expect.stringContaining(
                            'errors.kms.key_not_found',
                        ),
                    }),
                )
            },
            { timeout: 10_000 },
        )
        expect(sendSpy).not.toHaveBeenCalled()
        expect(screen.queryByTestId('send_success')).toBeFalsy()
        // Back on Confirm with the sender intact.
        await waitFor(() => {
            expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
        })
        expect(useAccountsStore.getState().selectedAccountId).toBe(sender.id)
    })

    it('Given the keystore throws an untyped error while signing, when the user confirms the send, then the toast carries the signing-specific copy rather than the generic banner', async () => {
        const sender = await seedAlgo25Sender()
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')
        // What keystore-core raises for a child whose sealed material
        // cannot be used: a plain Error, no i18n key of its own.
        const signSpy = vi
            .spyOn(getProvider().key.store, 'sign')
            .mockRejectedValue(new Error('key child does not hold key bytes'))
        onTestFinished(() => signSpy.mockRestore())
        const sendSpy = vi.fn(() =>
            HttpResponse.json({ txId: 'UNREACHED' }, { status: 200 }),
        )
        server.use(http.post('*/v2/transactions', sendSpy))

        renderSendConfirmationStack()
        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
        })
        fireEvent.click(confirmButton)

        await waitFor(
            () => {
                expect(
                    vi.mocked(Notifier.showNotification),
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'errors.signing.title',
                        description: expect.stringContaining(
                            'errors.signing.local_key_failed',
                        ),
                    }),
                )
            },
            { timeout: 10_000 },
        )
        expect(sendSpy).not.toHaveBeenCalled()
        expect(screen.queryByTestId('send_success')).toBeFalsy()
        // Back on Confirm with the sender intact.
        await waitFor(() => {
            expect(screen.getByTestId('send_confirm_button')).toBeTruthy()
        })
        expect(useAccountsStore.getState().selectedAccountId).toBe(sender.id)
    })

    // Kept last on purpose. A missing auth account fails inside the local-key
    // signer's auth-resolution step; that failure path leaves the signing
    // lifecycle's module-scoped actor registry occupied, and the single-flight
    // queue guard then blocks any request a *subsequent* test enqueues. The
    // registry has no barrel-exported reset, so ordering this case last is the
    // only in-test way to keep it from poisoning the others.
    it('Given a rekeyed sender whose auth account is missing from the wallet, when the user confirms the send, then the pipeline rejects (no algod POST) and an error is surfaced', async () => {
        // Same shape as the happy-path rekey case, but the auth
        // account is intentionally NOT registered in the
        // accounts store. `resolveAuthAccount` will throw
        // DelegationTargetNotFoundError before any signing happens —
        // surfaced as a toast, no algod traffic.
        const rekeyedAccount: WalletAccount = {
            id: 'rekeyed-orphan',
            custody: { kind: 'local', seed: null },
            chains: { algorand: { address: HD_TEST_ADDRESS } },
            name: 'Rekeyed sender (orphan)',
        }
        seedAuthority(addressOf(rekeyedAccount), ALGO25_TEST_ADDRESS)
        useAccountsStore.getState().setAccounts([rekeyedAccount])
        useAccountsStore.getState().setSelectedAccountId(rekeyedAccount.id)

        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(ALGO25_TEST_ADDRESS)
        useSendFundsStore.getState().setSendMode('normal')

        // The chain still reports the rekey, but the wallet has
        // no key for the auth address — the failure mode under
        // test is "auth account is missing from the wallet", not
        // "chain disagrees with the wallet about the rekey."
        server.use(
            mockAlgodAccountInformation({
                address: addressOf(rekeyedAccount),
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

        const confirmButton = await findEnabledByTestId('send_confirm_button', {
            timeout: 5000,
        })

        fireEvent.click(confirmButton)

        // The signing pipeline rejects before the algod POST.
        // Surface mechanism is a toast; assert it fired AND that
        // no /v2/transactions POST was made. Together these prove
        // the rejection happened at the auth-resolution layer,
        // not somewhere downstream.
        await waitFor(
            () => {
                expect(vi.mocked(Notifier.showNotification)).toHaveBeenCalled()
            },
            { timeout: 10_000 },
        )
        expect(sendSpy).not.toHaveBeenCalled()
    })
})

describe('Flow: save the recipient as a contact from Confirm Transaction', () => {
    // The store itself, not a hook render per read: each renderHook would stay
    // mounted for the rest of the test.
    const savedContacts = () => useContactsStore.getState().contacts

    const resetContacts = () => {
        act(() => {
            useContactsStore.getState().resetState()
        })
    }

    // The test navigator drops headers, so this stands in for the back button.
    const AddContactWithBack = () => {
        const navigation = useNavigation()
        return (
            <>
                <AddContactScreen />
                <button
                    data-testid='add_contact_back'
                    onClick={() => navigation.goBack()}
                >
                    back
                </button>
            </>
        )
    }

    const renderConfirmWithAddContact = () =>
        renderWithNavigation(
            TransactionConfirmationScreen,
            'ConfirmTransaction',
            {
                additionalScreens: [
                    { name: 'AddContact', component: AddContactWithBack },
                ],
            },
        )

    const prefillSend = () => {
        useSendFundsStore
            .getState()
            .setSelectedAsset({ chainId: 'algorand', assetId: NATIVE_ASSET_ID })
        useSendFundsStore.getState().setAmount(new Decimal(1))
        useSendFundsStore.getState().setDestination(RECEIVER_ADDRESS)
    }

    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
        useSendFundsStore.getState().reset()
        resetContacts()
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
            mockIndexerSearchForAccounts(),
        )
    })

    afterEach(() => {
        resetContacts()
    })

    it('Given an unknown recipient, when the user adds it from the To row, then Add Contact opens prefilled, saving returns to Confirm, and the link goes away', async () => {
        await seedAlgo25Sender()
        prefillSend()

        renderConfirmWithAddContact()

        fireEvent.click(
            await screen.findByTestId(
                'send_save_recipient_contact_button',
                undefined,
                { timeout: 5000 },
            ),
        )

        // The recipient arrives as the contact's Algorand address row.
        expect(
            await screen.findByTestId('contact_address_row_algorand'),
        ).toBeTruthy()
        fireEvent.change(screen.getByTestId('contact_name_input'), {
            target: { value: 'Bob' },
        })
        await waitFor(() =>
            expect(
                isElementDisabled(screen.getByTestId('add_contact_button')),
            ).toBe(false),
        )
        fireEvent.click(screen.getByTestId('add_contact_button'))

        await waitFor(() =>
            expect(savedContacts()).toEqual([
                expect.objectContaining({
                    name: 'Bob',
                    addresses: { algorand: RECEIVER_ADDRESS },
                }),
            ]),
        )
        await screen.findByTestId('send_confirm_button')
        expect(
            screen.queryByTestId('send_save_recipient_contact_button'),
        ).toBeNull()
    })

    it('Given Add Contact is open from the To row, when the user backs out, then Confirm is unchanged, the link is still there and no contact is saved', async () => {
        await seedAlgo25Sender()
        prefillSend()

        renderConfirmWithAddContact()

        fireEvent.click(
            await screen.findByTestId(
                'send_save_recipient_contact_button',
                undefined,
                { timeout: 5000 },
            ),
        )
        await screen.findByTestId('contact_address_row_algorand')
        fireEvent.click(screen.getByTestId('add_contact_back'))

        expect(await screen.findByTestId('send_confirm_button')).toBeTruthy()
        expect(
            screen.getByTestId('send_save_recipient_contact_button'),
        ).toBeTruthy()
        expect(savedContacts()).toEqual([])
    })

    it('Given the recipient is already a contact, then the To row offers no save button', async () => {
        await seedAlgo25Sender()
        act(() => {
            useContactsStore.getState().addContact({
                name: 'Bob',
                addresses: { algorand: RECEIVER_ADDRESS },
            })
        })
        prefillSend()

        renderSendConfirmationStack()

        await screen.findByTestId('send_confirm_button', undefined, {
            timeout: 5000,
        })
        expect(
            screen.queryByTestId('send_save_recipient_contact_button'),
        ).toBeNull()
    })
})
