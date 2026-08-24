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
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    act,
    fireEvent,
    renderHook,
    screen,
    waitFor,
} from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { Notifier } from 'react-native-notifier'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
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
    upsertAccountBalance,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { AccountHistory } from '@modules/accounts/components/AccountHistory/AccountHistory'
import { TransactionDetailsScreen } from '@modules/signing/screens/TransactionDetailsScreen/TransactionDetailsScreen'
import { useAccountHistory } from '@modules/accounts/components/AccountHistory/useAccountHistory'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

const ACCOUNT: WalletAccount = {
    id: 'observer-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'observer-key',
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
    confirmedRound: 100,
    roundTime: 1_700_000_000,
    swapGroupDetail: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(1_000_000), // 1 ALGO
    closeTo: null,
    closeAmount: null,
    asset: null,
    applicationId: null,
    innerTransactionCount: null,
    balanceImpacts: [],
}

const TX_ASSET_TRANSFER: TransactionHistoryItem = {
    id: 'TXASSETTRANSFER000000000000000000000000000000000000002',
    txType: 'axfer',
    sender: HD_TEST_ADDRESS,
    receiver: ALGO25_TEST_ADDRESS,
    confirmedRound: 99,
    roundTime: 1_699_900_000,
    swapGroupDetail: null,
    interpretedMeaning: null,
    fee: new Decimal(1000),
    groupId: null,
    amount: new Decimal(2_500_000),
    closeTo: null,
    closeAmount: null,
    asset: {
        assetId: '31566704',
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
    },
    applicationId: null,
    innerTransactionCount: null,
    balanceImpacts: [],
}

describe('Flow: View transactions → tap into details', () => {
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
        await seedAlgoAsset('mainnet')

        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT.address)
        vi.mocked(Notifier.showNotification).mockClear()

        // Account balance row so the history hook has something to
        // anchor its query against.
        await upsertAccountBalance({
            accountAddress: ACCOUNT.address,
            network: 'mainnet',
            algoBalance: new Decimal(5_000_000),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal(100_000),
            status: 'Offline',
            authAddress: null,
        })

        // Seed two transactions for the observer account. The history
        // hook reads page 1 from the local DB, so this is enough for
        // the list to render without touching the network.
        await upsertTransactions({
            items: [TX_PAYMENT, TX_ASSET_TRANSFER],
            accountAddress: ACCOUNT.address,
            network: 'mainnet',
        })
    })

    it(
        'Given an account with an empty history, the History tab shows its title and empty view (PERA-4676)',
        async () => {
            // Clear the transactions seeded in beforeEach so the selected
            // account has an empty history — the brand-new "deposit ALGO to
            // get started" state that previously rendered a blank History tab.
            await resetTestDatabase()
            await seedAlgoAsset('mainnet')

            // An empty SQLite read no longer means "no history" on its own —
            // it also happens while the initial sync is still writing — so the
            // hook confirms against the API before showing the empty view.
            server.use(
                http.get(`*/v1/accounts/${ACCOUNT.address}/transactions/`, () =>
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
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given seeded transactions, when the user taps the payment row, then the details screen renders for that transaction',
        async () => {
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
                            // PERA-4974: a note is what crashed this screen
                            // once the detail had been cached to disk. The
                            // indexer sends it base64; algosdk decodes it to
                            // bytes, so this also guards the note row against
                            // the byte-decoding hardening silently hiding it.
                            note: 'UEVSQS00OTc0IG5vdGU=',
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
            server.use(
                http.get(`*/v2/transactions/${TX_PAYMENT.id}`, lookupSpy),
            )

            renderWithNavigation(AccountHistory, 'AccountHistory', {
                additionalScreens: [
                    {
                        name: 'TransactionDetails',
                        component: TransactionDetailsScreen,
                    },
                ],
            })

            // The TransactionListItem renders its title via
            // `getTitle()` which keys off direction relative to the
            // selected account. Our seeded `TX_PAYMENT` has the
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
                            (_, node) =>
                                (node?.textContent ?? '') === SEND_LABEL,
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
            const leaf =
                matches.find(el => el.children.length === 0) ?? matches[0]
            const row = leaf.closest('button')
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
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a close-out payment ("send max"), the history list shows the swept amount and the details screen shows the close-remainder row (PERA-4897)',
        async () => {
            // A close-out carries the whole balance in closeAmount with
            // amount 0 — the bug rendered these rows as "0 ALGO". Re-seed
            // with only the close-out so the send row is unambiguous.
            await resetTestDatabase()
            await seedAlgoAsset('mainnet')
            const closeOutTx: TransactionHistoryItem = {
                ...TX_PAYMENT,
                id: 'TXCLOSEOUT000000000000000000000000000000000000000003',
                amount: new Decimal(0),
                closeTo: HD_TEST_ADDRESS,
                closeAmount: new Decimal(50_854_132_929),
            }
            await upsertTransactions({
                items: [closeOutTx],
                accountAddress: ACCOUNT.address,
                network: 'mainnet',
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
            server.use(
                http.get(`*/v2/transactions/${closeOutTx.id}`, lookupSpy),
            )

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
                            (_, node) =>
                                (node?.textContent ?? '') === SEND_LABEL,
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
            const leaf =
                matches.find(el => el.children.length === 0) ?? matches[0]
            const row = leaf.closest('button')
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
                screen.getByTestId('transaction_detail_close_amount')
                    .textContent,
            ).toMatch(/50[,.\s  ]?854/)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the DB returned a full page of transactions (hasNextPage true), when the consumer triggers handleLoadMore, then the next-page API endpoint is hit and the new transactions are appended',
        async () => {
            // Fewer rows than the DB page size, so SQLite is exhausted in one
            // read and the next page is the api page this test exercises.
            const fullPage: TransactionHistoryItem[] = Array.from(
                { length: 25 },
                (_, i) => ({
                    id: `TXPAGE1${i.toString().padStart(48, '0')}`,
                    txType: 'pay',
                    sender: ALGO25_TEST_ADDRESS,
                    receiver: HD_TEST_ADDRESS,
                    confirmedRound: 1000 - i,
                    // Same day so they all land in one section — keeps the
                    // grouping check trivial; the test cares about pagination,
                    // not date bucketing. Base is noon UTC so the 25-minute
                    // span doesn't cross midnight in any reasonable TZ.
                    roundTime: 1_700_049_600 - i * 60,
                    swapGroupDetail: null,
                    interpretedMeaning: null,
                    fee: new Decimal(1000),
                    groupId: null,
                    amount: new Decimal(1_000_000),
                    closeTo: null,
                    closeAmount: null,
                    asset: null,
                    applicationId: null,
                    innerTransactionCount: null,
                    balanceImpacts: [],
                }),
            )
            await upsertTransactions({
                items: fullPage,
                accountAddress: ACCOUNT.address,
                network: 'mainnet',
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
            const apiSpy = vi.fn(() =>
                HttpResponse.json(
                    {
                        current_round: 1100,
                        next: null,
                        previous: null,
                        results: [olderTx],
                    },
                    { status: 200 },
                ),
            )
            server.use(
                http.get(
                    `*/v1/accounts/${ACCOUNT.address}/transactions/`,
                    apiSpy,
                ),
            )

            // Wrap the hook in a fresh QueryClient — `useAccountHistory`
            // calls `useTransactionHistoryQuery` which is a TanStack
            // infinite-query, and react-query needs a provider. Zustand
            // stores (account, network) are global singletons, so they
            // work without a wrapper.
            const queryClient = createTestQueryClient()
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
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
            expect(apiSpy).not.toHaveBeenCalled()

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
                    expect(apiSpy).toHaveBeenCalled()
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
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
