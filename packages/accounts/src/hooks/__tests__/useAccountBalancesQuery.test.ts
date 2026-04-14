/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useAccountBalancesQuery,
    useAccountAssetBalanceQuery,
} from '../useAccountBalancesQuery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'

// Mock DB layer
const mockGetAccountBalance = vi.fn()
const mockGetAccountHoldings = vi.fn()
const mockFetchAndPersistAccount = vi.fn()

vi.mock('../../db', () => ({
    getAccountBalance: (...args: unknown[]) => mockGetAccountBalance(...args),
    getAccountHoldings: (...args: unknown[]) => mockGetAccountHoldings(...args),
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

const mockUsdToPreferred = vi.fn((amount: Decimal) => amount)
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        usdToPreferred: mockUsdToPreferred,
    })),
}))

const mockAssets = new Map()
const mockAssetPrices = new Map()

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: mockAssets,
        isPending: false,
    })),
    useAssetPricesQuery: vi.fn(() => ({
        data: mockAssetPrices,
        isPending: false,
    })),
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { id: '0', decimals: 6 },
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useAccountBalances', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUsdToPreferred.mockImplementation((amount: Decimal) => amount)
        mockAssets.clear()
        mockAssetPrices.clear()
        mockGetAccountBalance.mockReturnValue(undefined)
        mockGetAccountHoldings.mockReturnValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('returns empty data when no accounts provided', () => {
        const { result } = renderHook(() => useAccountBalancesQuery([]), {
            wrapper: createWrapper(),
        })

        expect(result.current.accountBalances.size).toBe(0)
        expect(result.current.isPending).toBe(false)
        expect(result.current.isFetched).toBe(false)
        expect(result.current.isRefetching).toBe(false)
        expect(result.current.isError).toBe(false)
    })

    it('reads balances from DB and aggregates correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        // Mock DB reads
        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1), // 1 ALGO (whole units)
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([
            { assetId: '123', amount: new Decimal(100) },
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData).toBeDefined()
        // With empty asset prices mock, algoValue includes the ALGO balance
        expect(accountData?.algoValue).toEqual(new Decimal(1))

        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(1))
    })

    it('calculates asset balances with prices correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        // Setup asset metadata and prices
        mockAssets.set('456', { id: '456', decimals: 2, name: 'Test Token' })
        mockAssets.set('789', {
            id: '789',
            decimals: 6,
            name: 'Another Token',
        })
        mockAssetPrices.set('0', { usdPrice: new Decimal(2) }) // ALGO at $2
        mockAssetPrices.set('456', { usdPrice: new Decimal(10) }) // Token at $10
        mockAssetPrices.set('789', { usdPrice: new Decimal(0.5) }) // Token at $0.50

        // Mock DB reads
        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(5), // 5 ALGO (whole units)
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([
            { assetId: '456', amount: new Decimal(1000) }, // 10.00 tokens (decimals: 2)
            { assetId: '789', amount: new Decimal(2000000) }, // 2.0 tokens (decimals: 6)
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData).toBeDefined()

        // Check that both asset balances were calculated
        const asset456 = accountData?.assetBalances.find(
            b => b.assetId === '456',
        )
        expect(asset456).toBeDefined()
        expect(asset456?.amount).toEqual(new Decimal(10)) // 1000 / 10^2

        const asset789 = accountData?.assetBalances.find(
            b => b.assetId === '789',
        )
        expect(asset789).toBeDefined()
        expect(asset789?.amount).toEqual(new Decimal(2)) // 2000000 / 10^6

        // Check ALGO balance was added
        const algoBalance = accountData?.assetBalances.find(
            b => b.assetId === '0',
        )
        expect(algoBalance).toBeDefined()
        expect(algoBalance?.amount).toEqual(new Decimal(5)) // 5000000 / 10^6

        // Portfolio totals: 50 (asset456) + 0.5 (asset789) + 5 (ALGO) = 55.5 ALGO
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(55.5))
    })

    it('passes filters through to getAccountHoldings', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([])

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

        expect(mockGetAccountHoldings).toHaveBeenCalledWith(
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
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([])

        const { result, rerender } = renderHook(
            ({ hideNfts }: { hideNfts: boolean }) =>
                useAccountBalancesQuery([account], true, { hideNfts }),
            {
                wrapper: createWrapper(),
                initialProps: { hideNfts: false },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const initialCalls = mockGetAccountHoldings.mock.calls.length
        expect(initialCalls).toBeGreaterThan(0)

        rerender({ hideNfts: true })

        await waitFor(() =>
            expect(mockGetAccountHoldings.mock.calls.length).toBeGreaterThan(
                initialCalls,
            ),
        )

        const lastCallArgs = mockGetAccountHoldings.mock.calls.at(-1)?.[0]
        expect(lastCallArgs).toEqual(
            expect.objectContaining({ hideNfts: true }),
        )
    })

    it('handles assets with zero price correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockAssets.set('999', {
            id: '999',
            decimals: 0,
            name: 'No Price Token',
        })
        mockAssetPrices.set('0', { usdPrice: new Decimal(1) })

        // Mock DB reads
        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([
            { assetId: '999', amount: new Decimal(100) },
        ])

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        const asset999 = accountData?.assetBalances.find(
            b => b.assetId === '999',
        )

        expect(asset999).toBeDefined()
        expect(asset999?.amount).toEqual(new Decimal(100)) // decimals: 0
        expect(asset999?.algoValue).toEqual(new Decimal(0)) // No price means 0 value
    })

    it('falls back to fetchAndPersistAccount when the balance row is missing', async () => {
        const account: WalletAccount = {
            address: 'NEW_ADDR',
            name: 'Freshly imported',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        // First read: no row in DB. Second read (after fallback sync): row present.
        mockGetAccountBalance
            .mockReturnValueOnce(undefined)
            .mockReturnValueOnce({
                accountAddress: 'NEW_ADDR',
                algoBalance: new Decimal('1.656'),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                authAddress: null,
            })
        mockFetchAndPersistAccount.mockResolvedValueOnce(undefined)

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(mockFetchAndPersistAccount).toHaveBeenCalledWith(
            'NEW_ADDR',
            'mainnet',
        )
        const accountData = result.current.accountBalances.get('NEW_ADDR')
        const algo = accountData?.assetBalances.find(b => b.assetId === '0')
        expect(algo?.amount).toEqual(new Decimal('1.656'))
    })

    it('does not call fetchAndPersistAccount when the balance row is already present', async () => {
        const account: WalletAccount = {
            address: 'EXISTING',
            name: 'Existing',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'EXISTING',
            algoBalance: new Decimal(0),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })

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
        mockUsdToPreferred.mockImplementation((amount: Decimal) => amount)
        mockAssets.clear()
        mockAssetPrices.clear()
        mockGetAccountBalance.mockReturnValue(undefined)
        mockGetAccountHoldings.mockReturnValue([])
        mockFetchAndPersistAccount.mockResolvedValue(undefined)
    })

    it('returns specific asset balance for an account', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockAssets.set('123', { id: '123', decimals: 4, name: 'Target Asset' })
        mockAssetPrices.set('0', { usdPrice: new Decimal(1) })
        mockAssetPrices.set('123', { usdPrice: new Decimal(5) })

        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 2,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([
            { assetId: '123', amount: new Decimal(50000) }, // 5.0000 tokens (decimals: 4)
            { assetId: '456', amount: new Decimal(10000) }, // Different asset
        ])

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123'),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toBeDefined()
        if (result.current.data) {
            expect(result.current.data.assetId).toBe('123')
            expect(result.current.data.amount).toEqual(new Decimal(5)) // 50000 / 10^4
        }
    })

    it('returns null when asset not found in holdings', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'algo25',
            canSign: true,
        }

        mockAssetPrices.set('0', { usdPrice: new Decimal(1) })

        mockGetAccountBalance.mockReturnValue({
            accountAddress: 'ADDR1',
            algoBalance: new Decimal(1),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            authAddress: null,
        })
        mockGetAccountHoldings.mockReturnValue([])

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
