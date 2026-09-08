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

// Portfolio aggregation: accounts store -> useAccountValueTotalsQuery (the
// per-account SQL totals PortfolioView and the account lists render) plus
// useAccountBalancesQuery for the per-asset rows.
//
// Stays at the hook layer deliberately, so the assertion is on the aggregation
// math. PortfolioView wraps these same hooks but also pulls balance history and
// the preferred-currency rate, both out of scope here.

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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { server } from '@test-utils/msw-server'
import { createTestQueryClient } from '@test-utils/render'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    resetTestDatabase,
    seedAlgoAsset,
    seedAssets,
    setupTestDatabase,
    teardownTestDatabase,
} from '@test-utils/database-setup'
import {
    AccountTypes,
    insertAssetHolding,
    upsertAccountBalance,
    useAccountBalancesQuery,
    useAccountsStore,
    useAccountValueTotalsQuery,
    useSigningAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { upsertAssetPrices } from '@perawallet/wallet-core-assets'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const SLOW_TEST_TIMEOUT_MS = 30_000

// USDC-like ASA with 6 decimals — same shape as the asset used in
// existing send-asa / view-transactions fixtures so the math is easy to
// reason about at a glance.
const USDC_ASSET = {
    assetId: '31566704',
    name: 'USD Coin',
    unitName: 'USDC',
    decimals: 6,
    creator: 'CREATORADDRESS00000000000000000000000000000000000000',
    deleted: false,
    isVerified: true,
    isCollectible: false,
    totalSupply: '18446744073709551615',
    url: '',
    metadataHash: '',
    defaultFrozen: false,
    manager: '',
    reserve: '',
    freeze: '',
    clawback: '',
    peraMetadata: null,
} as unknown as Parameters<typeof seedAssets>[0][number]

const ACCOUNT_A: WalletAccount = {
    id: 'portfolio-a',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'portfolio-a-key',
    name: 'Trading',
}

const ACCOUNT_B: WalletAccount = {
    id: 'portfolio-b',
    type: AccountTypes.algo25,
    address: HD_TEST_ADDRESS,
    keyPairId: 'portfolio-b-key',
    name: 'Long-term',
}

const NETWORK = 'mainnet' as const

describe('Flow: Dashboard portfolio aggregation', () => {
    beforeAll(async () => {
        server.listen({ onUnhandledRequest: 'bypass' })
        await setupTestDatabase()
    })
    afterEach(() => server.resetHandlers())
    afterAll(async () => {
        server.close()
        await teardownTestDatabase()
    })

    beforeEach(async () => {
        await resetTestDatabase()
        await seedAlgoAsset(NETWORK)
        await seedAssets([USDC_ASSET], NETWORK)
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([])
    })

    it(
        'Given two signing accounts with seeded ALGO + ASA balances and seeded USD prices, when the portfolio hooks resolve, then portfolioUsdValue equals the sum across accounts and per-account values are exposed',
        async () => {
            // Two signing accounts in the store. `useSigningAccounts`
            // filters by type — algo25 qualifies, watch does not.
            useAccountsStore.getState().setAccounts([ACCOUNT_A, ACCOUNT_B])

            // ALGO balances (in micro-ALGO base units, matching what the
            // sync service writes after fetching from algod).
            await upsertAccountBalance({
                accountAddress: ACCOUNT_A.address,
                network: NETWORK,
                algoBalance: new Decimal(10_000_000), // 10 ALGO
                totalAssetsOptedIn: 1,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })
            await upsertAccountBalance({
                accountAddress: ACCOUNT_B.address,
                network: NETWORK,
                algoBalance: new Decimal(4_000_000), // 4 ALGO
                totalAssetsOptedIn: 1,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(100_000),
                status: 'Offline',
                authAddress: null,
            })

            // ALGO holdings — ALGO is a regular holding row now (base units /
            // microalgos, 6 decimals), written by the sync the same way ASAs
            // are. The home-screen reads pull it from the holdings table, so it
            // must be seeded here rather than only on the account_balances row.
            await insertAssetHolding({
                accountAddress: ACCOUNT_A.address,
                assetId: '0',
                network: NETWORK,
                amount: '10000000', // 10 ALGO
            })
            await insertAssetHolding({
                accountAddress: ACCOUNT_B.address,
                assetId: '0',
                network: NETWORK,
                amount: '4000000', // 4 ALGO
            })

            // ASA holdings — both accounts hold USDC. Amounts are in base
            // units (USDC has 6 decimals → 1 USDC = 1_000_000 base units).
            await insertAssetHolding({
                accountAddress: ACCOUNT_A.address,
                assetId: USDC_ASSET.assetId,
                network: NETWORK,
                amount: '50000000', // 50 USDC
            })
            await insertAssetHolding({
                accountAddress: ACCOUNT_B.address,
                assetId: USDC_ASSET.assetId,
                network: NETWORK,
                amount: '20000000', // 20 USDC
            })

            // Prices: USDC at $1, ALGO at... whatever — the per-asset
            // arithmetic is well-tested in the unit suite. The
            // integration value here is "DB → hook → totals" with both
            // assets contributing.
            await upsertAssetPrices({
                prices: [
                    { assetId: '0', usdPrice: new Decimal('0.30') },
                    {
                        assetId: USDC_ASSET.assetId,
                        usdPrice: new Decimal('1.00'),
                    },
                ],
                network: NETWORK,
            })

            // Wrap in a fresh QueryClient so the queries can settle —
            // the accounts store + network are global singletons so
            // they don't need a wrapper.
            const queryClient = createTestQueryClient()
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            )

            const { result } = renderHook(
                () => {
                    const accounts = useSigningAccounts()
                    const balances = useAccountBalancesQuery(accounts, true)
                    const portfolio = useAccountValueTotalsQuery(accounts)
                    return { accounts, balances, portfolio }
                },
                { wrapper },
            )

            // Both signing accounts make it through useSigningAccounts.
            expect(result.current.accounts.map(a => a.address)).toEqual([
                ACCOUNT_A.address,
                ACCOUNT_B.address,
            ])

            // Wait for both balance queries + asset metadata + prices to
            // resolve. After that, accountBalances Map has an entry per
            // account and portfolio totals stop being pending.
            await waitFor(
                () => {
                    expect(result.current.balances.isPending).toBe(false)
                    expect(result.current.balances.accountBalances.size).toBe(2)
                    expect(result.current.portfolio.isPending).toBe(false)
                },
                { timeout: 5000 },
            )

            // Per-account assetBalances cover both ALGO and USDC.
            const balanceA = result.current.balances.accountBalances.get(
                ACCOUNT_A.address,
            )
            const balanceB = result.current.balances.accountBalances.get(
                ACCOUNT_B.address,
            )
            expect(balanceA?.assetBalances.map(b => b.assetId).sort()).toEqual(
                ['0', USDC_ASSET.assetId].sort(),
            )
            expect(balanceB?.assetBalances.map(b => b.assetId).sort()).toEqual(
                ['0', USDC_ASSET.assetId].sort(),
            )

            // Portfolio total accumulates contributions from both
            // accounts — proves the aggregation crosses the per-account
            // boundary rather than collapsing on a single one.
            const totalA = result.current.portfolio.accountValueTotals.get(
                ACCOUNT_A.address,
            )?.usdValue
            const totalB = result.current.portfolio.accountValueTotals.get(
                ACCOUNT_B.address,
            )?.usdValue
            expect(totalA).toBeDefined()
            expect(totalB).toBeDefined()
            // ACCOUNT_A holds more of both assets, so its USD subtotal
            // must dominate ACCOUNT_B's. Avoiding hard-coded dollar
            // figures because the unit conversion of ALGO base units
            // (micro-ALGO) at the price layer is captured in unit tests;
            // the integration check here is that A > B > 0 and the sum
            // matches the parts.
            expect(totalA!.greaterThan(totalB!)).toBe(true)
            expect(totalB!.greaterThan(0)).toBe(true)

            const sumOfParts = totalA!.plus(totalB!)
            expect(
                result.current.portfolio.portfolioUsdValue?.equals(sumOfParts),
            ).toBe(true)
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the accounts store is empty, when the portfolio hooks resolve, then accountBalances is empty and portfolioUsdValue is zero',
        async () => {
            useAccountsStore.getState().setAccounts([])

            const queryClient = createTestQueryClient()
            const wrapper = ({ children }: { children: React.ReactNode }) => (
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            )
            const { result } = renderHook(
                () => {
                    const accounts = useSigningAccounts()
                    const balances = useAccountBalancesQuery(accounts, true)
                    const portfolio = useAccountValueTotalsQuery(accounts)
                    return { accounts, balances, portfolio }
                },
                { wrapper },
            )

            // No accounts → useSigningAccounts returns []. Both hooks
            // short-circuit and skip the queries entirely, producing a zero
            // total without needing any network or DB I/O.
            expect(result.current.accounts).toEqual([])
            expect(result.current.balances.accountBalances.size).toBe(0)
            expect(result.current.portfolio.portfolioUsdValue?.isZero()).toBe(
                true,
            )
            expect(result.current.portfolio.accountValueTotals.size).toBe(0)
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
