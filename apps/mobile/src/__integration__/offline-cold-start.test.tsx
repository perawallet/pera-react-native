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

// Cold start with no connectivity (OFF-009). Two halves, and the distinction
// between them is the whole point of the ticket:
//
//   - previously synced -> SQLite has balances, holdings, prices and
//     transactions, so every surface renders last-known values. No skeleton
//     loop, no zeros.
//   - never synced -> there is genuinely nothing to show, so money values must
//     resolve to a placeholder. A rendered 0 has to mean a real zero balance.
//
// `onlineManager.setOnline(false)` is what makes this a cold *offline* start:
// under TanStack's default networkMode every query would pause before its
// queryFn ran, which is the failure this ticket exists to prevent.

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

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
    insertAssetHolding,
    upsertAccountBalance,
    useAccountBalancesQuery,
    useAccountSummaryQuery,
    useAccountValueTotalsQuery,
    useAccountsStore,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { upsertAssetPrices } from '@perawallet/wallet-core-assets'
import {
    useCurrency,
    useCurrenciesStore,
} from '@perawallet/wallet-core-currencies'
import {
    upsertTransactions,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { AccountHistory } from '@modules/accounts/components/AccountHistory/AccountHistory'
import { useAccountHistory } from '@modules/accounts/components/AccountHistory/useAccountHistory'
import { useNetworkStatusStore } from '@modules/network'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000
const NETWORK = 'mainnet' as const

const ACCOUNT: WalletAccount = {
    id: 'offline-cold-start',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'offline-cold-start-key',
    name: 'Synced',
}

const CACHED_TX: TransactionHistoryItem = {
    id: 'TXOFFLINECACHED000000000000000000000000000000000000001',
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

const wrapperWithClient = () => {
    const queryClient = createTestQueryClient()
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

/** Everything the sync service would have written on a previous online run. */
const seedPreviouslySyncedAccount = async () => {
    await upsertAccountBalance({
        accountAddress: ACCOUNT.address,
        network: NETWORK,
        algoBalance: new Decimal(10_000_000), // 10 ALGO
        totalAssetsOptedIn: 0,
        totalCreatedAssets: 0,
        totalAppsOptedIn: 0,
        minBalance: new Decimal(100_000),
        status: 'Offline',
        authAddress: null,
    })
    await insertAssetHolding({
        accountAddress: ACCOUNT.address,
        assetId: '0',
        network: NETWORK,
        amount: '10000000', // 10 ALGO in base units
    })
    await upsertAssetPrices({
        prices: [{ assetId: '0', usdPrice: new Decimal('0.30') }],
        network: NETWORK,
    })
    await upsertTransactions({
        items: [CACHED_TX],
        accountAddress: ACCOUNT.address,
        network: NETWORK,
    })
}

describe('Flow: Cold start with no connectivity', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
        await setupTestDatabase()
    })
    afterEach(() => {
        server.resetHandlers()
        onlineManager.setOnline(true)
        useNetworkStatusStore.getState().setHasInternet(true)
        useCurrenciesStore.getState().setPreferredCurrency('USD')
    })
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset(NETWORK)
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ACCOUNT])
        useAccountsStore.getState().setSelectedAccountAddress(ACCOUNT.address)
    })

    it(
        'Given a previously-synced install with no connectivity, when the app cold starts, then portfolio totals, holdings and history all resolve from SQLite instead of pinning on skeletons',
        async () => {
            await seedPreviouslySyncedAccount()

            // Offline before the first render — the cold-start case, not a
            // connection dropped mid-session.
            onlineManager.setOnline(false)
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderHook(
                () => {
                    const accounts = useSigningAccounts()
                    return {
                        totals: useAccountValueTotalsQuery(accounts),
                        balances: useAccountBalancesQuery(accounts, true),
                        summary: useAccountSummaryQuery(ACCOUNT.address),
                        history: useAccountHistory(),
                    }
                },
                { wrapper: wrapperWithClient() },
            )

            // The crux: pending clears while offline. Under a paused query it
            // never would, and every consumer below would sit in a skeleton.
            await waitFor(
                () => {
                    expect(result.current.totals.isPending).toBe(false)
                    expect(result.current.balances.isPending).toBe(false)
                    expect(result.current.summary.isPending).toBe(false)
                },
                { timeout: 5000 },
            )

            // Last-known balances, not zeros.
            expect(result.current.summary.algoAmount.toString()).toBe('10')
            expect(result.current.totals.portfolioUsdValue?.toString()).toBe(
                '3',
            )
            expect(
                result.current.balances.accountBalances.get(ACCOUNT.address)
                    ?.assetBalances.length,
            ).toBeGreaterThan(0)

            // History renders the cached row rather than an empty state.
            await waitFor(() => {
                expect(result.current.history.isInitialLoad).toBe(false)
            })
            expect(result.current.history.isEmpty).toBe(false)
            expect(result.current.history.isOfflineEmpty).toBe(false)
            expect(
                result.current.history.rows.some(
                    row => row.kind !== 'header' && row.key === CACHED_TX.id,
                ),
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a never-synced install with no connectivity, when a fiat amount is displayed, then the conversion resolves to a placeholder rather than 0',
        async () => {
            // No prices seeded: seedAlgoAsset writes metadata only, which is
            // exactly the state of a fresh import that has never been online.
            useCurrenciesStore.getState().setPreferredCurrency('EUR')
            onlineManager.setOnline(false)
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderHook(() => useCurrency(), {
                wrapper: wrapperWithClient(),
            })

            await waitFor(() => {
                expect(result.current.isRatePending).toBe(true)
            })

            // The ticket's "no fake numbers" rule: an unknown rate yields no
            // value at all, which CurrencyAmount renders as a placeholder.
            expect(result.current.usdToPreferred(new Decimal(100))).toBeNull()
            expect(result.current.algoUsdPrice).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a never-synced install holding ALGO and the default USD currency, when the portfolio resolves, then the fiat total is unknown rather than 0',
        async () => {
            // Holdings but no prices — seedAlgoAsset writes metadata only. USD
            // is the store default, so this is the common fresh-import case and
            // the one that can't lean on an unresolved *rate* to stay honest:
            // the rate is the identity, and it's the missing *price* that makes
            // the total unknown.
            await upsertAccountBalance({
                accountAddress: ACCOUNT.address,
                network: NETWORK,
                algoBalance: new Decimal(10_000_000), // 10 ALGO
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })
            await insertAssetHolding({
                accountAddress: ACCOUNT.address,
                assetId: '0',
                network: NETWORK,
                amount: '10000000',
            })

            onlineManager.setOnline(false)
            useNetworkStatusStore.getState().setHasInternet(false)

            const { result } = renderHook(
                () => {
                    const accounts = useSigningAccounts()
                    return useAccountValueTotalsQuery(accounts)
                },
                { wrapper: wrapperWithClient() },
            )

            await waitFor(() => {
                expect(result.current.isPending).toBe(false)
            })

            // The ALGO-denominated total is real and price-independent.
            expect(result.current.portfolioAlgoValue.toString()).toBe('10')

            // The USD total is NOT 0 — we hold 10 ALGO and simply don't know
            // what it's worth. Reporting 0 here is the fake number the epic
            // forbids, and it reaches the user as "$0.00".
            expect(result.current.portfolioUsdValue).toBeNull()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a normal online session, when the same surfaces render, then nothing about them changed — real totals, real conversions, and the ordinary empty copy',
        async () => {
            // AC #7. Everything this ticket touches has an offline branch; this
            // pins the online branch so the honesty work can't leak into it.
            await seedPreviouslySyncedAccount()
            useCurrenciesStore.getState().setPreferredCurrency('EUR')
            server.use(
                http.get('*/v1/currencies/EUR', () =>
                    HttpResponse.json(
                        {
                            currency_id: 'EUR',
                            name: 'Euro',
                            symbol: '€',
                            usd_value: '0.90',
                            exchange_price: '0.90',
                            last_updated_at: '2026-08-28T00:00:00Z',
                        },
                        { status: 200 },
                    ),
                ),
            )

            const { result } = renderHook(
                () => {
                    const accounts = useSigningAccounts()
                    return {
                        totals: useAccountValueTotalsQuery(accounts),
                        currency: useCurrency(),
                        history: useAccountHistory(),
                    }
                },
                { wrapper: wrapperWithClient() },
            )

            await waitFor(() => {
                expect(result.current.totals.isPending).toBe(false)
                expect(result.current.currency.isRatePending).toBe(false)
            })

            // Real totals, not placeholders.
            expect(result.current.totals.portfolioUsdValue?.toString()).toBe(
                '3',
            )
            // 10 ALGO * $0.30 = $3.00 -> EUR at 0.90 = 2.7
            expect(
                result.current.currency
                    .usdToPreferred(new Decimal(3))
                    ?.toString(),
            ).toBe('2.7')
            // Cached rows still render, and nothing claims to be offline.
            expect(result.current.history.isOfflineEmpty).toBe(false)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given a never-synced install with no connectivity, when the History tab renders, then it says the device is offline instead of claiming there are no transactions',
        async () => {
            // Balance row only — no transactions were ever synced.
            await upsertAccountBalance({
                accountAddress: ACCOUNT.address,
                network: NETWORK,
                algoBalance: new Decimal(0),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })

            onlineManager.setOnline(false)
            useNetworkStatusStore.getState().setHasInternet(false)

            renderWithNavigation(AccountHistory, 'AccountHistory')

            // i18n isn't initialized under the integration setup, so `t()`
            // falls through to the raw key.
            await waitFor(
                () => {
                    expect(
                        screen.queryAllByText(
                            (_, node) =>
                                (node?.textContent ?? '') ===
                                'asset_details.transaction_list.offline_empty_title',
                        ).length,
                    ).toBeGreaterThan(0)
                },
                { timeout: 5000 },
            )

            // The genuine "this account has no transactions" copy must not be
            // what an offline user sees.
            expect(
                screen.queryAllByText(
                    (_, node) =>
                        (node?.textContent ?? '') ===
                        'asset_details.transaction_list.empty_body',
                ),
            ).toHaveLength(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
