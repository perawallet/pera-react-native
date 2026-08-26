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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    useAccountBalancesQuery,
    useAccountAssetBalanceQuery,
} from '../useAccountBalancesQuery'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'

// Mock DB layer. The hook now reads enriched, pre-joined holdings (asset
// metadata + USD price per row) via getAccountHoldingsPage, and ALGO is itself
// a holding row (base units / microalgos, 6 decimals) — no separate IN-list
// metadata/price queries and no client-side ALGO append.
const mockGetAccountBalance = vi.fn()
const mockGetAccountHoldingsPage = vi.fn()
const mockFetchAndPersistAccount = vi.fn()

vi.mock('../../db', () => ({
    getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
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

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { assetId: '0', decimals: 6 },
}))

// Helpers to build enriched holding rows as getAccountHoldingsPage returns them.
type Row = {
    assetId: string
    amount: Decimal
    isFrozen?: boolean
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

const account: WalletAccount = {
    address: 'ADDR1',
    name: 'Account 1',
    id: '1',
    type: 'algo25',
    canSign: true,
} as WalletAccount

// Restore the global onlineManager singleton so an offline test can't leak
// its state into subsequent tests.
afterEach(() => {
    onlineManager.setOnline(true)
})

describe('useAccountBalances', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountBalance.mockReturnValue({ algoBalance: new Decimal(0) })
        mockGetAccountHoldingsPage.mockResolvedValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('serves account balances from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.algoValue).toEqual(new Decimal(1))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(1))
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(() => useAccountBalancesQuery([]), {
            wrapper: createWrapper(),
        })

        expect(result.current.accountBalances.size).toBe(0)
        expect(result.current.isPending).toBe(false)
    })

    it('keeps the result referentially stable across renders with a fresh but equal accounts array', async () => {
        // Call sites like AccountWithBalance pass `[account]` as a fresh
        // literal every render. If array identity feeds the memo, every render
        // of every row re-walks all holdings — a Decimal per field per asset
        // (PERA-4953).
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result, rerender } = renderHook(
            ({ accounts }: { accounts: WalletAccount[] }) =>
                useAccountBalancesQuery(accounts),
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
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.algoValue).toEqual(new Decimal(1))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(1))
    })

    it('exposes the holding-level frozen flag on asset balances', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 1),
            { ...asaRow('456', 1000, 2, 10, 'Frozen NFT'), isFrozen: true },
            // A row with unsynced metadata must still carry the flag.
            { ...asaRow('789', 1, null, null), isFrozen: true },
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const balances =
            result.current.accountBalances.get('ADDR1')?.assetBalances
        expect(balances?.find(b => b.assetId === '456')?.isFrozen).toBe(true)
        expect(balances?.find(b => b.assetId === '789')?.isFrozen).toBe(true)
        expect(balances?.find(b => b.assetId === '0')?.isFrozen).toBe(false)
    })

    it('calculates asset balances with prices correctly', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(5_000_000, 2), // 5 ALGO @ $2
            asaRow('456', 1000, 2, 10, 'Test'), // 10 units @ $10 → 50 ALGO
            asaRow('789', 2_000_000, 6, 0.5, 'Another'), // 2 units @ $0.5 → 0.5 ALGO
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
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
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(55.5))
        // 100 (456) + 1 (789) + 10 (ALGO) = $111
        expect(accountData?.usdValue).toEqual(new Decimal(111))
    })

    it('treats a holding with no price as zero in the USD total', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 2), // 1 ALGO @ $2
            asaRow('999', 100, 0, 0, 'Unpriced'),
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
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
            hideOptedInNfts: false,
        }

        const { result } = renderHook(
            () => useAccountBalancesQuery([account], true, filters),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(mockGetAccountHoldingsPage).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: 'ADDR1',
                network: 'mainnet',
                hideZeroBalance: true,
                hideNfts: true,
                hideOptedInNfts: false,
            }),
        )
    })

    it('refetches with a fresh DB read when filters change', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result, rerender } = renderHook(
            ({ hideNfts }: { hideNfts: boolean }) =>
                useAccountBalancesQuery([account], true, { hideNfts }),
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
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const asset999 = result.current.accountBalances
            .get('ADDR1')
            ?.assetBalances.find(b => b.assetId === '999')
        expect(asset999?.amount).toEqual(new Decimal(100)) // decimals: 0
        expect(asset999?.algoValue).toEqual(new Decimal(0)) // no price → 0
    })

    it('emits zero amount and zero algoValue when asset metadata is not yet loaded', async () => {
        // A holding whose metadata hasn't synced (asset: null) must carry zeros
        // so its base-unit amount can't leak into the value-desc sort.
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 2),
            asaRow('456', 1_000_000, null, 10), // asset null → unsynced
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const unloaded = result.current.accountBalances
            .get('ADDR1')
            ?.assetBalances.find(b => b.assetId === '456')
        expect(unloaded?.amount).toEqual(new Decimal(0))
        expect(unloaded?.algoValue).toEqual(new Decimal(0))
        expect(unloaded?.asset).toBeUndefined()

        // Portfolio total ignores the unscalable row — just the ALGO balance.
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(1))
    })

    it('falls back to fetchAndPersistAccount when the balance row is missing', async () => {
        const newAccount = { ...account, address: 'NEW_ADDR' } as WalletAccount
        mockGetAccountBalance.mockReturnValueOnce(undefined)
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_656_000, 1)])

        const { result } = renderHook(
            () => useAccountBalancesQuery([newAccount]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(mockFetchAndPersistAccount).toHaveBeenCalledWith(
            'NEW_ADDR',
            'mainnet',
        )
        const algo = result.current.accountBalances
            .get('NEW_ADDR')
            ?.assetBalances.find(b => b.assetId === '0')
        expect(algo?.amount).toEqual(new Decimal('1.656'))
    })

    it('does not call fetchAndPersistAccount when the balance row is present', async () => {
        mockGetAccountBalance.mockReturnValue({ algoBalance: new Decimal(0) })

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(mockFetchAndPersistAccount).not.toHaveBeenCalled()
    })
})

describe('useAccountAssetBalanceQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetAccountBalance.mockReturnValue({ algoBalance: new Decimal(0) })
        mockGetAccountHoldingsPage.mockResolvedValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('returns specific asset balance for an account', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([
            algoRow(1_000_000, 1),
            asaRow('123', 50000, 4, 5, 'Target Asset'), // 5.0000 tokens
        ])

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data?.assetId).toBe('123')
        expect(result.current.data?.amount).toEqual(new Decimal(5))
    })

    it('returns null when asset not found in holdings', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([algoRow(1_000_000, 1)])

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeNull()
    })

    it('does not query when account is undefined', () => {
        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(undefined, '123'),
            { wrapper: createWrapper() },
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toBeNull()
    })
})
