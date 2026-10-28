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

// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    CHAIN_CAPABILITIES,
    type ChainCapabilities,
    type ChainDescriptor,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import {
    useAccountBalancesQuery,
    useAccountAssetBalanceQuery,
    useAccountHoldingsAcrossChainsQuery,
} from '../useAccountBalancesQuery'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'
import { buildTestAccount, testAccount } from '../../__tests__/accountFactory'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

// Mock DB layer. The hook now reads enriched, pre-joined holdings (asset
// metadata + USD price per row) via getAccountHoldingsPage, and ALGO is itself
// a holding row (base units / microalgos, 6 decimals) — no separate IN-list
// metadata/price queries and no client-side ALGO append.
const mockGetAccountChainStateRow = vi.fn()
const mockGetAccountHoldingsPage = vi.fn()
const mockFetchAndPersistAccount = vi.fn()

vi.mock('../../db', () => ({
    getAccountChainStateRow: (...args: unknown[]) =>
        mockGetAccountChainStateRow(...args),
    getAccountHoldingsPage: (...args: unknown[]) =>
        mockGetAccountHoldingsPage(...args),
}))

vi.mock('../../sync/account-syncer', () => ({
    fetchAndPersistAccount: (...args: unknown[]) =>
        mockFetchAndPersistAccount(...args),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    }
})

const NATIVE_ASSETS = vi.hoisted(() => ({
    algorand: { assetId: '0', decimals: 6 },
    // ChainId is a closed union, so the 18-decimal chain rides on Ethereum's.
    ethereum: { assetId: 'native', decimals: 18 },
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: (chainId: keyof typeof NATIVE_ASSETS) =>
        NATIVE_ASSETS[chainId],
}))

// Helpers to build enriched holding rows as getAccountHoldingsPage returns them.
type Row = {
    assetId: string
    amount: Decimal
    native?: { family: 'algorand'; isFrozen: boolean }
    asset: { assetId: string; decimals: number; name?: string } | null
    usdPrice: Decimal | null
    isFavorited: boolean
}
const algoRow = (microalgos: number, usd: number | null): Row => ({
    assetId: '0',
    amount: new Decimal(microalgos),
    asset: { assetId: '0', decimals: 6, name: 'Algo' },
    usdPrice: usd === null ? null : new Decimal(usd),
    isFavorited: false,
})
const asaRow = (
    assetId: string,
    baseAmount: number,
    decimals: number | null,
    usd: number | null,
    name?: string,
): Row => ({
    assetId,
    amount: new Decimal(baseAmount),
    asset: decimals === null ? null : { assetId, decimals, name },
    usdPrice: usd === null ? null : new Decimal(usd),
    isFavorited: false,
})

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const account: WalletAccount = testAccount('local', 'ADDR1', {
    id: '1',
    name: 'Account 1',
})

// Restore the global onlineManager singleton so an offline test can't leak
// its state into subsequent tests.
afterEach(() => {
    onlineManager.setOnline(true)
})

describe('useAccountBalances', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountChainStateRow.mockReturnValue({
            nativeBalance: new Decimal(0),
        })
        mockGetAccountHoldingsPage.mockResolvedValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('serves account balances from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.nativeValue).toEqual(new Decimal(1))
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(1))
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(
            () => useAccountBalancesQuery([], SCOPE),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.accountBalances.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('keeps the result referentially stable across renders with a fresh but equal accounts array', async () => {
        // Call sites like AccountWithBalance pass `[account]` as a fresh
        // literal every render. If array identity feeds the memo, every render
        // of every row re-walks all holdings — a Decimal per field per asset.
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result, rerender } = renderHook(
            ({ accounts }: { accounts: WalletAccount[] }) =>
                useAccountBalancesQuery(accounts, SCOPE),
            {
                wrapper: createWrapper(),
                initialProps: { accounts: [account] },
            },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        const firstBalances = result.current.accountBalances
        rerender({ accounts: [{ ...account }] })

        expect(result.current.accountBalances).toBe(firstBalances)
    })

    it('reads balances from DB and aggregates correctly', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.nativeValue).toEqual(new Decimal(1))
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(1))
    })

    it('derives the holding restriction from its native data', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 1),
            {
                ...asaRow('456', 1000, 2, 10, 'Frozen NFT'),
                native: { family: 'algorand' as const, isFrozen: true },
            },
            // A row with unsynced metadata must still carry the restriction.
            {
                ...asaRow('789', 1, null, null),
                native: { family: 'algorand' as const, isFrozen: true },
            },
            // A fresh holding the next sync hasn't described yet has none.
            asaRow('321', 1, 0, null),
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const balances =
            result.current.accountBalances.get('ADDR1')?.assetBalances
        const restrictionOf = (assetId: string) =>
            balances?.find(b => b.assetId === assetId)?.restriction
        expect(restrictionOf('456')).toBe('transferBlocked')
        expect(restrictionOf('789')).toBe('transferBlocked')
        expect(restrictionOf('0')).toBeNull()
        expect(restrictionOf('321')).toBeNull()
    })

    it('calculates asset balances with prices correctly', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(5_000_000, 2), // 5 ALGO @ $2
            asaRow('456', 1000, 2, 10, 'Test'), // 10 units @ $10 → 50 ALGO
            asaRow('789', 2_000_000, 6, 0.5, 'Another'), // 2 units @ $0.5 → 0.5 ALGO
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(
            accountData?.assetBalances.find(b => b.assetId === '456')?.amount,
        ).toEqual(new Decimal(10))
        expect(
            accountData?.assetBalances.find(b => b.assetId === '789')?.amount,
        ).toEqual(new Decimal(2))
        expect(
            accountData?.assetBalances.find(b => b.assetId === '0')?.amount,
        ).toEqual(new Decimal(5))

        // 50 (456) + 0.5 (789) + 5 (ALGO) = 55.5 ALGO
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(55.5))
        // 100 (456) + 1 (789) + 10 (ALGO) = $111
        expect(accountData?.usdValue).toEqual(new Decimal(111))
    })

    it('treats a holding with no price as zero in the USD total', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 2), // 1 ALGO @ $2
            asaRow('999', 100, 0, 0, 'Unpriced'),
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.accountBalances.get('ADDR1')?.usdValue).toEqual(
            new Decimal(2),
        )
    })

    it('passes filters through to the holdings read', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const filters = {
            hideZeroBalance: true,
            hideNfts: true,
            hideZeroBalanceNfts: false,
        }

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE, true, filters),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(mockGetAccountHoldingsPage).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: 'ADDR1',
                scope: { chainId: 'algorand', networkId: 'mainnet' },
                hideZeroBalance: true,
                hideNfts: true,
                hideZeroBalanceNfts: false,
            }),
        )
    })

    it('refetches with a fresh DB read when filters change', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result, rerender } = renderHook(
            ({ hideNfts }: { hideNfts: boolean }) =>
                useAccountBalancesQuery([account], SCOPE, true, { hideNfts }),
            { wrapper: createWrapper(), initialProps: { hideNfts: false } },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const initialCalls = mockGetAccountHoldingsPage.mock.calls.length

        rerender({ hideNfts: true })

        await waitFor(() =>
            expect(
                mockGetAccountHoldingsPage.mock.calls.length,
            ).toBeGreaterThan(initialCalls),
        )
        expect(mockGetAccountHoldingsPage.mock.calls.at(-1)?.[0]).toEqual(
            expect.objectContaining({ hideNfts: true }),
        )
    })

    it('handles assets with zero price correctly', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 1),
            asaRow('999', 100, 0, null, 'No Price'),
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const asset999 = result.current.accountBalances
            .get('ADDR1')
            ?.assetBalances.find(b => b.assetId === '999')
        expect(asset999?.amount).toEqual(new Decimal(100)) // decimals: 0
        expect(asset999?.nativeValue).toBeNull()
    })

    describe('while the native price is unloaded', () => {
        const rows = [algoRow(100_000, null), asaRow('31566704', 500, 0, 1)]
        const renderAccount = async () => {
            mockGetAccountHoldingsPage.mockResolvedValue(rows)
            const { result } = renderHook(
                () => useAccountBalancesQuery([account], SCOPE),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))
            return result.current
        }

        it('keeps the native-only total on a single-chain wallet', async () => {
            const { accountBalances, portfolioNativeValue } =
                await renderAccount()

            expect(accountBalances.get('ADDR1')?.nativeValue).toEqual(
                new Decimal('0.1'),
            )
            expect(portfolioNativeValue).toEqual(new Decimal('0.1'))
        })

        it('leaves the total unknown once a second chain is registered, rather than dropping the priced ASA', async () => {
            const allOn = Object.fromEntries(
                CHAIN_CAPABILITIES.map(capability => [capability, true]),
            ) as ChainCapabilities
            for (const id of ['algorand', 'ethereum']) {
                getProvider().chains.register(
                    { id, networks: [] } as unknown as ChainDescriptor,
                    allOn,
                )
            }

            const { accountBalances, portfolioNativeValue } =
                await renderAccount()

            expect(accountBalances.get('ADDR1')?.nativeValue).toBeNull()
            expect(portfolioNativeValue).toBeNull()
        })
    })

    it('emits a zero amount and an unknown nativeValue when asset metadata is not yet loaded', async () => {
        // A holding whose metadata hasn't synced (asset: null) must carry zeros
        // so its base-unit amount can't leak into the value-desc sort.
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 2),
            asaRow('456', 1_000_000, null, 10), // asset null → unsynced
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const unloaded = result.current.accountBalances
            .get('ADDR1')
            ?.assetBalances.find(b => b.assetId === '456')
        expect(unloaded?.amount).toEqual(new Decimal(0))
        expect(unloaded?.nativeValue).toBeNull()
        expect(unloaded?.asset).toBeUndefined()

        // Portfolio total ignores the unscalable row — just the ALGO balance.
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(1))
    })

    it('falls back to fetchAndPersistAccount when the chain-state row is missing', async () => {
        const newAccount = testAccount('local', 'NEW_ADDR', { id: '2' })
        mockGetAccountChainStateRow.mockReturnValueOnce(undefined)
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_656_000, 1)])

        const { result } = renderHook(
            () => useAccountBalancesQuery([newAccount], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(mockFetchAndPersistAccount).toHaveBeenCalledWith(
            'NEW_ADDR',
            SCOPE,
        )
        const algo = result.current.accountBalances
            .get('NEW_ADDR')
            ?.assetBalances.find(b => b.assetId === '0')
        expect(algo?.amount).toEqual(new Decimal('1.656'))
    })

    it('does not call fetchAndPersistAccount when the chain-state row is present', async () => {
        mockGetAccountChainStateRow.mockReturnValue({
            nativeBalance: new Decimal(0),
        })

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(mockFetchAndPersistAccount).not.toHaveBeenCalled()
    })

    describe('a chain whose native asset has 18 decimals', () => {
        const ETH_SCOPE: ChainScope = {
            chainId: 'ethereum',
            networkId: 'mainnet',
        }
        const ethAccount = buildTestAccount(
            { kind: 'watch' },
            { ethereum: { address: 'ETH1' } },
            { id: 'eth' },
        )

        it('scales the native balance and prices every holding against it', async () => {
            mockGetAccountHoldingsPage.mockResolvedValue([
                {
                    assetId: 'native',
                    amount: new Decimal('1500000000000000000'),
                    asset: { assetId: 'native', decimals: 18 },
                    usdPrice: new Decimal(2000),
                    isFavorited: false,
                },
                asaRow('tok', 3_000_000, 6, 4),
            ])

            const { result } = renderHook(
                () => useAccountBalancesQuery([ethAccount], ETH_SCOPE),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))

            const data = result.current.accountBalances.get('ETH1')
            const nativeOf = (assetId: string) =>
                data?.assetBalances.find(b => b.assetId === assetId)
            expect(nativeOf('native')?.amount).toEqual(new Decimal('1.5'))
            expect(nativeOf('native')?.nativeValue).toEqual(new Decimal('1.5'))
            expect(nativeOf('native')?.fiatValue).toEqual(new Decimal(3000))
            // 3 units at $4 is $12, or 0.006 of the native asset at $2000.
            expect(nativeOf('tok')?.nativeValue).toEqual(new Decimal('0.006'))
            expect(data?.nativeValue).toEqual(new Decimal('1.506'))
            expect(data?.usdValue).toEqual(new Decimal(3012))
            expect(data?.fiatValue).toEqual(new Decimal(3012))
        })
    })

    describe('fiatValue', () => {
        const renderBalances = async () => {
            const { result } = renderHook(
                () => useAccountBalancesQuery([account], SCOPE),
                { wrapper: createWrapper() },
            )
            await waitFor(() => expect(result.current.isPending).toBe(false))
            return result.current.accountBalances.get('ADDR1')
        }
        const fiatOf = (
            data: Awaited<ReturnType<typeof renderBalances>>,
            assetId: string,
        ) => data?.assetBalances.find(b => b.assetId === assetId)?.fiatValue

        it('is null for an unpriced or unsynced holding and a Decimal otherwise', async () => {
            mockGetAccountHoldingsPage.mockResolvedValue([
                algoRow(5_000_000, 2),
                asaRow('456', 1000, 2, 10),
                asaRow('999', 100, 0, null),
                asaRow('777', 100, 0, 0),
                asaRow('789', 1_000_000, null, 10),
            ])

            const data = await renderBalances()

            expect(fiatOf(data, '0')).toEqual(new Decimal(10))
            expect(fiatOf(data, '456')).toEqual(new Decimal(100))
            expect(fiatOf(data, '999')).toBeNull()
            expect(fiatOf(data, '777')).toEqual(new Decimal(0))
            expect(fiatOf(data, '789')).toBeNull()
            expect(data?.fiatValue).toEqual(new Decimal(110))
            expect(data?.fiatValue).toEqual(data?.usdValue)
        })

        it('is null for the account when the native asset is held but unpriced', async () => {
            mockGetAccountHoldingsPage.mockResolvedValue([
                algoRow(1_000_000, null),
                asaRow('456', 1000, 2, 10),
            ])

            const data = await renderBalances()

            expect(data?.fiatValue).toBeNull()
            expect(fiatOf(data, '456')).toEqual(new Decimal(100))
            expect(data?.usdValue).toEqual(new Decimal(100))
            expect(data?.nativeValue).toEqual(new Decimal(1))
        })

        it('is a Decimal for the account when the unpriced native balance is zero', async () => {
            mockGetAccountHoldingsPage.mockResolvedValue([
                algoRow(0, null),
                asaRow('456', 1000, 2, 10),
            ])

            const data = await renderBalances()

            expect(data?.fiatValue).toEqual(new Decimal(100))
        })
    })
})

describe('useAccountAssetBalanceQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountChainStateRow.mockReturnValue({
            nativeBalance: new Decimal(0),
        })
        mockGetAccountHoldingsPage.mockResolvedValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('returns specific asset balance for an account', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 1),
            asaRow('123', 50000, 4, 5, 'Target Asset'), // 5.0000 tokens
        ])

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data?.assetId).toBe('123')
        expect(result.current.data?.amount).toEqual(new Decimal(5))
    })

    it('returns null when asset not found in holdings', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123', SCOPE),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeNull()
    })

    it('does not query when account is undefined', () => {
        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(undefined, '123', SCOPE),
            { wrapper: createWrapper() },
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toBeNull()
    })
})

describe('useAccountHoldingsAcrossChainsQuery', () => {
    const allOn = Object.fromEntries(
        CHAIN_CAPABILITIES.map(capability => [capability, true]),
    ) as ChainCapabilities

    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountChainStateRow.mockReturnValue({
            nativeBalance: new Decimal(0),
        })
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
        for (const id of ['algorand', 'ethereum']) {
            getProvider().chains.register(
                {
                    id,
                    networks: [
                        {
                            id: 'mainnet',
                            tier: 'mainnet',
                            isDefaultForTier: true,
                        },
                    ],
                } as unknown as ChainDescriptor,
                allOn,
            )
        }
    })

    it("lists the holdings on every chain the account has an address on, each with its chain's scope", async () => {
        mockGetAccountHoldingsPage.mockImplementation(
            async ({ scope }: { scope: ChainScope }) =>
                scope.chainId === 'ethereum'
                    ? [
                          {
                              assetId: 'native',
                              amount: new Decimal('2000000000000000000'),
                              asset: { assetId: 'native', decimals: 18 },
                              usdPrice: null,
                              isFavorited: false,
                          },
                      ]
                    : [algoRow(3_000_000, 1)],
        )
        const twoChainAccount = buildTestAccount(
            { kind: 'watch' },
            {
                algorand: { address: 'ALGO1' },
                ethereum: { address: 'ETH1' },
            },
            { id: 'two-chain' },
        )

        const { result } = renderHook(
            () => useAccountHoldingsAcrossChainsQuery(twoChainAccount),
            { wrapper: createWrapper() },
        )
        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(
            result.current.assetBalances.map(b => ({
                chainId: b.scope.chainId,
                assetId: b.assetId,
                amount: b.amount,
            })),
        ).toEqual([
            { chainId: 'algorand', assetId: '0', amount: new Decimal(3) },
            { chainId: 'ethereum', assetId: 'native', amount: new Decimal(2) },
        ])
    })

    it('lists nothing without an account', () => {
        const { result } = renderHook(
            () => useAccountHoldingsAcrossChainsQuery(null),
            { wrapper: createWrapper() },
        )

        expect(result.current).toEqual({ assetBalances: [], isPending: false })
    })
})
