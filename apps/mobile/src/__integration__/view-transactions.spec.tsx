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
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    act,
    fireEvent,
    within,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@rneui/themed'
import { http, HttpResponse } from 'msw'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient, getTestTheme } from '@test-utils/render'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    setupTestDatabase,
    teardownTestDatabase,
    seedAlgorandAccountState,
} from '@test-utils/database-setup'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { EMPTY_ALGORAND_HISTORY_DATA } from '@perawallet/wallet-core-chain-algorand/transactions'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import { AccountHistory } from '@modules/accounts/components/AccountHistory/AccountHistory'
import { TransactionDetailsScreen } from '@modules/signing/routes'
import { useAccountHistory } from '@modules/accounts/components/AccountHistory/useAccountHistory'
import { useWebViewStore } from '@modules/webview'
import { useContactsStore } from '@perawallet/wallet-core-contacts'
import { ALGORAND_CHAIN_ID } from '@modules/algorand/chain-id'

import * as Clipboard from 'expo-clipboard'
import { closestPressable, longPress } from '@test-utils/rnw'
import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'
import { addressOf } from './__fixtures__/accounts'

const MAINNET_SCOPE = {
    chainId: ALGORAND_CHAIN_ID,
    networkId: 'mainnet',
} as const

const ACCOUNT: WalletAccount = {
    id: 'observer-1',
    custody: { kind: 'local', seed: null },
    chains: {
        algorand: { address: ALGO25_TEST_ADDRESS, keyPairId: 'observer-key' },
    },
    name: 'Observer',
}

// Two pinned transactions seeded directly into the on-device DB. The
// production sync service writes the same shape from indexer
// responses; here we author them so the test doesn't depend on remote
// fixtures. Stable txIds so the details screen can look one up.
const TX_PAYMENT: TransactionHistoryItem = {
    id: 'TXPAYMENT0000000000000000000000000000000000000000000001',
    txType: 'pay',
    sender: ALGO25_TEST_ADDRESS,
    receiver: HD_TEST_ADDRESS,
    assetSender: null,
    confirmedRound: 100,
    roundTime: 1_700_000_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(1_000_000), // 1 ALGO
    asset: null,
    balanceImpacts: [],
}

const TX_ASSET_TRANSFER: TransactionHistoryItem = {
    id: 'TXASSETTRANSFER000000000000000000000000000000000000002',
    txType: 'axfer',
    sender: HD_TEST_ADDRESS,
    receiver: ALGO25_TEST_ADDRESS,
    assetSender: null,
    confirmedRound: 99,
    roundTime: 1_699_900_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(2_500_000),
    asset: {
        assetId: '31566704',
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
    },
    balanceImpacts: [],
}

// `stpf` used to fall through to the unsupported branch. Seeded
// per-test rather than in `beforeEach` so the existing row assertions keep
// counting exactly two transactions.
const TX_STATE_PROOF: TransactionHistoryItem = {
    id: 'TXSTATEPROOF000000000000000000000000000000000000000003',
    txType: 'stpf',
    sender: HD_TEST_ADDRESS,
    receiver: null,
    assetSender: null,
    confirmedRound: 98,
    roundTime: 1_699_800_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: null,
    asset: null,
    balanceImpacts: [],
}

// An ASA whose unit name is the native ticker. Seeded per-test, like the state proof.
const TX_SPOOF_TRANSFER: TransactionHistoryItem = {
    id: 'TXSPOOFTRANSFER000000000000000000000000000000000000005',
    txType: 'axfer',
    sender: HD_TEST_ADDRESS,
    receiver: ALGO25_TEST_ADDRESS,
    assetSender: null,
    confirmedRound: 96,
    roundTime: 1_699_600_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    amount: new Decimal(1_000_000_000),
    asset: {
        assetId: '999999999',
        name: 'Spoof',
        unitName: 'ALGO',
        decimals: 6,
    },
    balanceImpacts: [],
}

const RECIPIENT_CONTACT_NAME = 'Landlord'

const NOTE_BASE64 = 'UEVSQS00OTc0IG5vdGU='

const TX_APP_CALL: TransactionHistoryItem = {
    id: 'TXAPPCALL00000000000000000000000000000000000000000004',
    txType: 'appl',
    sender: ALGO25_TEST_ADDRESS,
    receiver: null,
    assetSender: null,
    confirmedRound: 97,
    roundTime: 1_699_700_000,
    chainData: null,
    interpretedMeaning: null,
    fee: new Decimal(3000),
    amount: null,
    asset: null,
    balanceImpacts: [],
}

describe('Flow: View transactions → tap into details', () => {
    beforeAll(async () => {
        await setupTestDatabase()
    })
    afterAll(async () => {
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        useContactsStore.getState().resetState()
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountId(ACCOUNT.id)

        // Account balance row so the history hook has something to
        // anchor its query against.
        await seedAlgorandAccountState({
            accountAddress: addressOf(ACCOUNT),
            scope: MAINNET_SCOPE,
            nativeBalance: new Decimal(5_000_000),
            minBalance: new Decimal(100_000),
        })

        // Seed two transactions for the observer account. The history
        // hook reads page 1 from the local DB, so this is enough for
        // the list to render without touching the network.
        await upsertTransactions({
            items: [TX_PAYMENT, TX_ASSET_TRANSFER],
            accountAddress: addressOf(ACCOUNT),
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
        })
    })

    it('Given an account with an empty history, the History tab shows its title and empty view', async () => {
        // Clear the transactions seeded in beforeEach so the selected
        // account has an empty history — the brand-new "get started"
        // state, which must render an empty view, not a blank History tab.
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')

        // An empty SQLite read no longer means "no history" on its own —
        // it also happens while the initial sync is still writing — so the
        // hook confirms against the API before showing the empty view.
        server.use(
            http.get(`*/v1/accounts/${addressOf(ACCOUNT)}/transactions/`, () =>
                HttpResponse.json(
                    {
                        current_round: 1100,
                        next: null,
                        previous: null,
                        results: [],
                    },
                    { status: 200 },
                ),
            ),
        )

        renderWithNavigation(AccountHistory, 'AccountHistory')

        // i18n isn't initialized under the integration setup, so `t()`
        // falls through to the raw key (matching the convention below).
        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) =>
                            (node?.textContent ?? '') ===
                            'asset_details.transaction_list.empty_body',
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )
        // The title must be present alongside the empty view — the bug was
        // that neither rendered.
        expect(
            screen.queryAllByText(
                (_, node) =>
                    (node?.textContent ?? '') ===
                    'asset_details.transaction_list.title',
            ).length,
        ).toBeGreaterThan(0)
    })

    it('Given seeded transactions, when the user taps the payment row, then the details screen renders for that transaction', async () => {
        // Spy on the indexer lookup so we can confirm the details
        // screen actually fetched by the right txId — it's
        // triggered when navigating with `transactionId` (the
        // history list's tap behavior).
        const lookupSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    'current-round': 100,
                    transaction: {
                        id: TX_PAYMENT.id,
                        'tx-type': 'pay',
                        sender: TX_PAYMENT.sender,
                        'confirmed-round': TX_PAYMENT.confirmedRound,
                        'round-time': TX_PAYMENT.roundTime,
                        fee: 1000,
                        // a note is what crashed this screen
                        // once the detail had been cached to disk. The
                        // indexer sends it base64; algosdk decodes it to
                        // bytes, so this also guards the note row against
                        // the byte-decoding hardening silently hiding it.
                        note: NOTE_BASE64,
                        'payment-transaction': {
                            receiver: TX_PAYMENT.receiver,
                            amount: 1_000_000,
                            'close-amount': 0,
                        },
                    },
                },
                { status: 200 },
            ),
        )
        server.use(http.get(`*/v2/transactions/${TX_PAYMENT.id}`, lookupSpy))

        // A saved contact keeps its name on the recipient row.
        useContactsStore.getState().addContact({
            addresses: { algorand: TX_PAYMENT.receiver ?? '' },
            name: RECIPIENT_CONTACT_NAME,
        })

        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

        // The row's title comes from the history adapter's summary, read
        // from the selected account's side. Our seeded `TX_PAYMENT` has the
        // selected account as sender → 'send'. The asset-transfer
        // tx has the selected account as receiver → 'receive'.
        // Both rows should mount once the DB read settles.
        // i18n isn't initialized under the integration setup, so
        // `t()` falls through to the raw key — assert against the
        // key, matching the convention used by the other flow tests.
        const SEND_LABEL = 'transactions.list_item.send'
        const RECEIVE_LABEL = 'transactions.list_item.receive'
        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) => (node?.textContent ?? '') === SEND_LABEL,
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )
        expect(
            screen.queryAllByText(
                (_, node) => (node?.textContent ?? '') === RECEIVE_LABEL,
            ).length,
        ).toBeGreaterThan(0)

        // Tap the send row (the payment) — walk to its wrapping
        // button. Multiple matches by text walker because
        // ancestors also satisfy the substring; we need the leaf.
        const matches = screen.queryAllByText(
            (_, node) => (node?.textContent ?? '') === SEND_LABEL,
        )
        const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
        const row = closestPressable(leaf)
        if (!row) {
            throw new Error('Payment row button not found')
        }
        fireEvent.click(row)

        // The details screen calls `indexer.lookupTransactionById`
        // which we intercepted. Wait for the spy to fire.
        await waitFor(
            () => {
                expect(lookupSpy).toHaveBeenCalled()
            },
            { timeout: 5000 },
        )

        // i18n isn't initialized here, so the note row's button renders
        // its raw key.
        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) =>
                            (node?.textContent ?? '') ===
                            'transactions.common.view_note',
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )

        expect(
            within(screen.getByTestId('transaction_detail_from')).getByText(
                truncateAlgorandAddress(TX_PAYMENT.sender),
            ),
        ).toBeTruthy()
        expect(
            screen.getByTestId('transaction_detail_to_contact').textContent,
        ).toContain(RECIPIENT_CONTACT_NAME)
        expect(
            within(screen.getByTestId('transaction_detail_fee')).getByText(
                /0\.001/,
            ),
        ).toBeTruthy()
        expect(
            screen.getAllByText(truncateAlgorandAddress(TX_PAYMENT.id)).length,
        ).toBeGreaterThan(0)

        // The hero leads, then the cards in order, each fact on the row the
        // frame gives it.
        expect(
            screen.getByTestId('transaction_detail_status').textContent,
        ).toBe('transactions.common.completed')
        expect(screen.getByTestId('transaction_detail_amount')).toBeTruthy()
        const inOrder = [
            'transaction_detail_network',
            'transaction_detail_id',
            'transaction_detail_date',
            'transaction_detail_block',
            'transaction_detail_from',
            'transaction_detail_to',
            'transaction_detail_fee',
            'transaction_detail_note',
            'transaction_detail_explorer',
        ].map(testID => screen.getByTestId(testID))
        inOrder.slice(1).forEach((card, index) => {
            expect(
                inOrder[index]!.compareDocumentPosition(card) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy()
        })
        expect(
            screen.getByTestId('transaction_detail_network').textContent,
        ).toContain('Algorand')
        expect(
            screen.getByTestId('transaction_detail_block').textContent,
        ).toContain('100')

        // The sender is one of the user's accounts, so its name sits under it.
        expect(
            screen.getByTestId('transaction_detail_from_account').textContent,
        ).toContain(ACCOUNT.name)
        expect(screen.queryByTestId('transaction_detail_to_account')).toBeNull()

        // A plain payment has no inner transactions or application details.
        expect(screen.queryByText('transactions.app_call.details')).toBeNull()
        expect(
            screen.queryByText('transactions.app_call.inner_transactions'),
        ).toBeNull()

        // Copying takes the full value, never the truncated text.
        vi.mocked(Clipboard.setStringAsync).mockClear()
        const copyOf = async (testID: string, shown: string, full: string) => {
            const pressable = closestPressable(
                within(screen.getByTestId(testID)).getByText(shown),
            )
            if (!pressable) throw new Error(`${testID} is not copyable`)
            await longPress(pressable)
            await waitFor(() =>
                expect(Clipboard.setStringAsync).toHaveBeenCalledWith(full),
            )
        }
        await copyOf(
            'transaction_detail_id',
            truncateAlgorandAddress(TX_PAYMENT.id),
            TX_PAYMENT.id,
        )
        await copyOf(
            'transaction_detail_from',
            truncateAlgorandAddress(TX_PAYMENT.sender),
            TX_PAYMENT.sender,
        )
        // A contact's name sits under its address; the address line copies.
        await copyOf(
            'transaction_detail_to',
            truncateAlgorandAddress(TX_PAYMENT.receiver ?? ''),
            TX_PAYMENT.receiver ?? '',
        )

        // The note opens from its link.
        fireEvent.click(
            closestPressable(
                screen.getByText('transactions.common.view_note'),
            ) ?? screen.getByText('transactions.common.view_note'),
        )
        expect(
            await screen.findByText(
                Buffer.from(NOTE_BASE64, 'base64').toString(),
            ),
        ).toBeTruthy()

        // The explorer link is Pera Explorer's page for this transaction.
        useWebViewStore.getState().clearWebViews()
        fireEvent.click(
            closestPressable(
                screen.getByTestId('transaction_detail_explorer'),
            ) ?? screen.getByTestId('transaction_detail_explorer'),
        )
        const [explorerView] = useWebViewStore.getState().openWebViews
        expect(explorerView?.url).toMatch(new RegExp(`/tx/${TX_PAYMENT.id}$`))
    })

    it('Given an application call with inner transactions, when the user taps its row, then the details screen shows them and its application details, with no note link', async () => {
        await upsertTransactions({
            items: [TX_APP_CALL],
            accountAddress: addressOf(ACCOUNT),
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
        })
        server.use(
            http.get(`*/v2/transactions/${TX_APP_CALL.id}`, () =>
                HttpResponse.json(
                    {
                        'current-round': 100,
                        transaction: {
                            id: TX_APP_CALL.id,
                            'tx-type': 'appl',
                            sender: TX_APP_CALL.sender,
                            'confirmed-round': TX_APP_CALL.confirmedRound,
                            'round-time': TX_APP_CALL.roundTime,
                            fee: 3000,
                            'application-transaction': {
                                'application-id': 1_002_541_853,
                                'on-completion': 'noop',
                                'application-args': ['AQID'],
                            },
                            'inner-txns': [1, 2].map(amount => ({
                                'tx-type': 'pay',
                                sender: TX_APP_CALL.sender,
                                'payment-transaction': {
                                    receiver: HD_TEST_ADDRESS,
                                    amount: amount * 1000,
                                },
                            })),
                        },
                    },
                    { status: 200 },
                ),
            ),
        )

        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

        const row = await screen.findByTestId(
            `transaction_row_${TX_APP_CALL.id}`,
            undefined,
            { timeout: 5000 },
        )
        fireEvent.click(closestPressable(row) ?? row)

        expect(
            await screen.findByText(
                'transactions.app_call.inner_transactions',
                undefined,
                { timeout: 5000 },
            ),
        ).toBeTruthy()
        expect(screen.getByText('transactions.app_call.details')).toBeTruthy()
        expect(
            screen.getByTestId('transaction_detail_status').textContent,
        ).toBe('transactions.common.completed')
        expect(screen.queryByTestId('transaction_detail_to')).toBeNull()
        expect(screen.queryByTestId('transaction_detail_note')).toBeNull()
        expect(screen.queryByText('transactions.common.view_note')).toBeNull()
    })

    it('Given seeded transactions, each row shows its summary: title, counterparty, signed amount and unit', async () => {
        renderWithNavigation(AccountHistory, 'AccountHistory')

        const paymentRow = await screen.findByTestId(
            `transaction_row_${TX_PAYMENT.id}`,
            undefined,
            { timeout: 5000 },
        )
        const transferRow = screen.getByTestId(
            `transaction_row_${TX_ASSET_TRANSFER.id}`,
        )

        expect(paymentRow.textContent).toContain('transactions.list_item.send')
        expect(paymentRow.textContent).toContain(
            truncateAlgorandAddress(HD_TEST_ADDRESS),
        )
        // ALGO renders as its glyph, not its ticker.
        expect(paymentRow.textContent).toMatch(/-\s*1\.00/)

        // USDC isn't in the asset DB, so its facts come from the summary.
        expect(transferRow.textContent).toContain(
            'transactions.list_item.receive',
        )
        expect(transferRow.textContent).toContain(
            truncateAlgorandAddress(HD_TEST_ADDRESS),
        )
        expect(transferRow.textContent).toMatch(/\+\s*2\.5\d*\s*USDC/)

        expect(
            screen.queryByTestId(
                `transaction_row_imitated_currency_${TX_PAYMENT.id}`,
            ),
        ).toBeNull()
        expect(
            screen.queryByTestId(
                `transaction_row_imitated_currency_${TX_ASSET_TRANSFER.id}`,
            ),
        ).toBeNull()
    })

    it('Given a received asset whose unit name is ALGO, its row warns that it is not ALGO and the real payment row does not', async () => {
        await upsertTransactions({
            items: [TX_SPOOF_TRANSFER],
            accountAddress: addressOf(ACCOUNT),
            scope: MAINNET_SCOPE,
        })

        renderWithNavigation(AccountHistory, 'AccountHistory')

        const marker = await screen.findByTestId(
            `transaction_row_imitated_currency_${TX_SPOOF_TRANSFER.id}`,
            undefined,
            { timeout: 5000 },
        )
        expect(marker.textContent).toContain('asset.imitated_currency.marker')
        expect(
            screen.queryByTestId(
                `transaction_row_imitated_currency_${TX_PAYMENT.id}`,
            ),
        ).toBeNull()
        expect(
            screen.queryByTestId(
                `transaction_row_imitated_currency_${TX_ASSET_TRANSFER.id}`,
            ),
        ).toBeNull()
    })

    it('Given a close-out payment ("send max"), the history list shows the swept amount and the details screen shows the close-remainder row', async () => {
        // A close-out carries the whole balance in closeAmount with
        // amount 0 — the bug rendered these rows as "0 ALGO". Re-seed
        // with only the close-out so the send row is unambiguous.
        await resetTestDatabase()
        await seedAlgoAsset('mainnet')
        const closeOutTx: TransactionHistoryItem = {
            ...TX_PAYMENT,
            id: 'TXCLOSEOUT000000000000000000000000000000000000000003',
            amount: new Decimal(0),
            chainData: {
                ...EMPTY_ALGORAND_HISTORY_DATA,
                closeTo: HD_TEST_ADDRESS,
                closeAmount: new Decimal(50_854_132_929),
            },
        }
        await upsertTransactions({
            items: [closeOutTx],
            accountAddress: addressOf(ACCOUNT),
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
        })

        const lookupSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    'current-round': 100,
                    transaction: {
                        id: closeOutTx.id,
                        'tx-type': 'pay',
                        sender: closeOutTx.sender,
                        'confirmed-round': closeOutTx.confirmedRound,
                        'round-time': closeOutTx.roundTime,
                        fee: 1000,
                        'payment-transaction': {
                            receiver: closeOutTx.receiver,
                            amount: 0,
                            'close-remainder-to': HD_TEST_ADDRESS,
                            'close-amount': 50_854_132_929,
                        },
                    },
                },
                { status: 200 },
            ),
        )
        server.use(http.get(`*/v2/transactions/${closeOutTx.id}`, lookupSpy))

        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

        const SEND_LABEL = 'transactions.list_item.send'
        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) => (node?.textContent ?? '') === SEND_LABEL,
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )

        // The row shows the swept 50,854.132929 ALGO, not 0. Match
        // loosely on the distinctive "50" + "854" grouping so the
        // assertion survives decimal-truncation formatting rules.
        const matches = screen.queryAllByText(
            (_, node) => (node?.textContent ?? '') === SEND_LABEL,
        )
        const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
        const row = closestPressable(leaf)
        if (!row) {
            throw new Error('Close-out row button not found')
        }
        expect(row.textContent).toMatch(/50[,.\s  ]?854/)

        // Tap into details: the amount reflects the close amount and
        // the close-remainder row renders with the destination.
        fireEvent.click(row)
        await waitFor(
            () => {
                expect(lookupSpy).toHaveBeenCalled()
            },
            { timeout: 5000 },
        )
        await waitFor(
            () => {
                expect(
                    screen.getByTestId('transaction_detail_close_to'),
                ).toBeTruthy()
            },
            { timeout: 5000 },
        )
        // Amount is the paid leg (0) — the sweep renders in its own
        // Remainder Amount row.
        expect(
            screen.getByTestId('transaction_detail_amount').textContent,
        ).not.toMatch(/50[,.\s  ]?854/)
        expect(
            screen.getByTestId('transaction_detail_close_amount').textContent,
        ).toMatch(/50[,.\s  ]?854/)
    })

    it('Given the DB returned a full page of transactions (hasNextPage true), when the consumer triggers handleLoadMore, then the next-page API endpoint is hit and the new transactions are appended', async () => {
        // Fewer rows than the DB page size, so SQLite is exhausted in one
        // read and the next page is the api page this test exercises.
        const fullPage: TransactionHistoryItem[] = Array.from(
            { length: 25 },
            (_, i) => ({
                id: `TXPAGE1${i.toString().padStart(48, '0')}`,
                txType: 'pay',
                sender: ALGO25_TEST_ADDRESS,
                receiver: HD_TEST_ADDRESS,
                assetSender: null,
                confirmedRound: 1000 - i,
                // Same day so they all land in one section — keeps the
                // grouping check trivial; the test cares about pagination,
                // not date bucketing. Base is noon UTC so the 25-minute
                // span doesn't cross midnight in any reasonable TZ.
                roundTime: 1_700_049_600 - i * 60,
                chainData: null,
                interpretedMeaning: null,
                fee: new Decimal(1000),
                amount: new Decimal(1_000_000),
                asset: null,
                balanceImpacts: [],
            }),
        )
        await upsertTransactions({
            items: fullPage,
            accountAddress: addressOf(ACCOUNT),
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
        })

        // Pera transaction-history endpoint. The endpoint URL is
        // `/v1/accounts/:address/transactions/`; we spy on it so we
        // can confirm the load-more path actually fires the network
        // request (not just bumps query state). Returns a single new
        // row so the merged list is observably longer.
        // Round and round time must agree: the api page is deduped against
        // the oldest row already held (round 99), so a "900" here would
        // read as newer than the boundary and be stripped as overlap.
        const olderTx = {
            id: 'TXOLDER0000000000000000000000000000000000000000000099',
            tx_type: 'pay' as const,
            sender: ALGO25_TEST_ADDRESS,
            receiver: HD_TEST_ADDRESS,
            confirmed_round: 50,
            round_time: 1_699_000_000,
            fee: '1000',
            amount: '500000',
        }
        // The address-safety check reads this endpoint from the newest page,
        // so only requests paging past the DB (`before_time`) are the list's.
        const listPageSpy = vi.fn()
        server.use(
            http.get(
                `*/v1/accounts/${addressOf(ACCOUNT)}/transactions/`,
                ({ request }) => {
                    if (new URL(request.url).searchParams.has('before_time')) {
                        listPageSpy()
                    }
                    return HttpResponse.json(
                        {
                            current_round: 1100,
                            next: null,
                            previous: null,
                            results: [olderTx],
                        },
                        { status: 200 },
                    )
                },
            ),
        )

        // Wrap the hook in a fresh QueryClient — `useAccountHistory`
        // calls `useTransactionHistoryQuery` which is a TanStack
        // infinite-query, and react-query needs a provider. Zustand
        // stores (account, network) are global singletons, so they
        // work without a wrapper.
        const queryClient = createTestQueryClient()
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ThemeProvider theme={getTestTheme()}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </ThemeProvider>
        )
        const { result } = renderHook(() => useAccountHistory(), {
            wrapper,
        })

        // First page comes from the local DB: the 25 seeded rows plus the
        // two from beforeEach, each date group led by a header.
        await waitFor(
            () => {
                expect(
                    result.current.rows.filter(
                        row => row.kind === 'transaction',
                    ),
                ).toHaveLength(27)
            },
            { timeout: 5000 },
        )
        expect(result.current.rows[0].kind).toBe('header')
        // hasNextPage flips on when the DB returned a full page —
        // production gates `handleLoadMore` on this same flag.
        expect(result.current.hasNextPage).toBe(true)
        expect(listPageSpy).not.toHaveBeenCalled()

        // Trigger the same path the list's onEndReached uses. wrap
        // in act so the resulting state mutations flush.
        act(() => {
            result.current.handleLoadMore()
        })

        // The hook fires the next-page request to Pera's transaction
        // history endpoint. Confirm the spy ran and the merged list
        // now includes the older tx.
        await waitFor(
            () => {
                expect(listPageSpy).toHaveBeenCalled()
            },
            { timeout: 5000 },
        )
        await waitFor(
            () => {
                const allIds = result.current.rows
                    .filter(row => row.kind === 'transaction')
                    .map(row => row.key)
                expect(allIds).toContain(olderTx.id)
            },
            { timeout: 5000 },
        )
    })
    it('Given a state proof transaction, when the user taps its row, then the details screen names the type instead of calling it unsupported', async () => {
        await upsertTransactions({
            items: [TX_STATE_PROOF],
            accountAddress: addressOf(ACCOUNT),
            scope: {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'mainnet',
            } as const,
        })

        const lookupSpy = vi.fn(() =>
            HttpResponse.json(
                {
                    'current-round': 100,
                    transaction: {
                        id: TX_STATE_PROOF.id,
                        'tx-type': 'stpf',
                        sender: TX_STATE_PROOF.sender,
                        'confirmed-round': TX_STATE_PROOF.confirmedRound,
                        'round-time': TX_STATE_PROOF.roundTime,
                        fee: 1000,
                    },
                },
                { status: 200 },
            ),
        )
        server.use(
            http.get(`*/v2/transactions/${TX_STATE_PROOF.id}`, lookupSpy),
        )

        renderWithNavigation(AccountHistory, 'AccountHistory', {
            additionalScreens: [
                {
                    name: 'TransactionDetails',
                    component: TransactionDetailsScreen,
                },
            ],
        })

        const ROW_LABEL = 'transactions.list_item.state_proof'
        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) => (node?.textContent ?? '') === ROW_LABEL,
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )

        const matches = screen.queryAllByText(
            (_, node) => (node?.textContent ?? '') === ROW_LABEL,
        )
        const leaf = matches.find(el => el.children.length === 0) ?? matches[0]
        const row = closestPressable(leaf)
        if (!row) {
            throw new Error('State proof row button not found')
        }
        fireEvent.click(row)

        await waitFor(
            () => {
                expect(lookupSpy).toHaveBeenCalled()
            },
            { timeout: 5000 },
        )

        await waitFor(
            () => {
                expect(
                    screen.queryAllByText(
                        (_, node) =>
                            (node?.textContent ?? '') ===
                            'transactions.state_proof.body',
                    ).length,
                ).toBeGreaterThan(0)
            },
            { timeout: 5000 },
        )

        // The regression: this type used to render the unsupported copy.
        expect(
            screen.queryAllByText(
                (_, node) =>
                    (node?.textContent ?? '') === 'transactions.unknown.body',
            ).length,
        ).toBe(0)
    })
})
