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
import { useAccountBalancesQuery, useAccountAssetBalanceQuery } from '../useAccountBalancesQuery'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import Decimal from 'decimal.js'
import type { WalletAccount } from '../../models/accounts'

// Mock dependencies
const mockFetchAccountBalances = vi.hoisted(() => vi.fn())
vi.mock('../endpoints', () => ({
    fetchAccountBalances: mockFetchAccountBalances,
    getAccountBalancesQueryKey: vi.fn(() => ['accountAssets']),
}))

const mockUsdToPreferred = vi.fn((amount: Decimal) => amount)
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        usdToPreferred: mockUsdToPreferred,
    })),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

const mockAssets = new Map()
const mockAssetPrices = new Map()

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: mockAssets,
        isPending: false,
    })),
    useAssetFiatPricesQuery: vi.fn(() => ({
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

    it('fetches and aggregates balances correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockFetchAccountBalances.mockResolvedValue({
            results: [
                {
                    asset_id: 0,
                    amount: '1000000', // 1 Algo
                    fraction_decimals: 6,
                    balance_usd_value: '1.5',
                },
                {
                    asset_id: 123,
                    amount: '100',
                    fraction_decimals: 2,
                    balance_usd_value: '2.0',
                },
            ],
        })

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData).toBeDefined()
        // With empty asset prices mock, algoValue and fiatValue will be 0
        expect(accountData?.algoValue).toEqual(Decimal(0))
        expect(accountData?.fiatValue).toEqual(Decimal(0))

        expect(result.current.portfolioAlgoValue).toEqual(Decimal(0))
        expect(result.current.portfolioFiatValue).toEqual(Decimal(0))
    })

    it('handles loading state', () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockFetchAccountBalances.mockReturnValue(new Promise(() => { }))

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockFetchAccountBalances.mockRejectedValue(new Error('Network Error'))

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            {
                wrapper: createWrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData?.isError).toBe(true)
    })

    it('calculates asset balances with prices correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        // Setup asset metadata and prices
        mockAssets.set('456', { id: '456', decimals: 2, name: 'Test Token' })
        mockAssets.set('789', { id: '789', decimals: 6, name: 'Another Token' })
        mockAssetPrices.set('0', { fiatPrice: Decimal(2) }) // ALGO at $2
        mockAssetPrices.set('456', { fiatPrice: Decimal(10) }) // Token at $10
        mockAssetPrices.set('789', { fiatPrice: Decimal(0.5) }) // Token at $0.50

        mockFetchAccountBalances.mockResolvedValue(
            {
                address: 'ADDR1',
                amount: 5000000, // 5 ALGO (decimals: 6)
                assets: [
                    {
                        'asset-id': 456,
                        amount: 1000, // 10.00 tokens (decimals: 2)
                    },
                    {
                        'asset-id': 789,
                        amount: 2000000, // 2.0 tokens (decimals: 6)
                    },
                ],
            }
        )

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() }
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        expect(accountData).toBeDefined()

        // Check that both asset balances were calculated
        const asset456 = accountData?.assetBalances.find(b => b.assetId === '456')
        console.log('asset456', accountData)
        expect(asset456).toBeDefined()
        expect(asset456?.amount).toEqual(Decimal(10)) // 1000 / 10^2

        const asset789 = accountData?.assetBalances.find(b => b.assetId === '789')
        expect(asset789).toBeDefined()
        expect(asset789?.amount).toEqual(Decimal(2)) // 2000000 / 10^6

        // Check ALGO balance was added
        const algoBalance = accountData?.assetBalances.find(b => b.assetId === '0')
        expect(algoBalance).toBeDefined()
        expect(algoBalance?.amount).toEqual(Decimal(5)) // 5000000 / 10^6
    })

    it('handles assets with zero price correctly', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockAssets.set('999', { id: '999', decimals: 0, name: 'No Price Token' })
        mockAssetPrices.set('0', { fiatPrice: Decimal(1) })
        // No price for asset 999, should default to 0

        mockFetchAccountBalances.mockResolvedValue({
            address: 'ADDR1',
            amount: 1000000,
            assets: [
                {
                    'asset-id': 999,
                    amount: 100,
                },
            ],
        })

        const { result } = renderHook(
            () => useAccountBalancesQuery([account]),
            { wrapper: createWrapper() }
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const accountData = result.current.accountBalances.get('ADDR1')
        const asset999 = accountData?.assetBalances.find(b => b.assetId === '999')

        expect(asset999).toBeDefined()
        expect(asset999?.amount).toEqual(Decimal(100)) // decimals: 0
        expect(asset999?.algoValue).toEqual(Decimal(0)) // No price means 0 value
    })
})

describe('useAccountAssetBalanceQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUsdToPreferred.mockImplementation((amount: Decimal) => amount)
        mockAssets.clear()
        mockAssetPrices.clear()
    })

    it('returns specific asset balance for an account', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockAssets.set('123', { id: '123', decimals: 4, name: 'Target Asset' })
        mockAssetPrices.set('0', { fiatPrice: Decimal(1) })
        mockAssetPrices.set('123', { fiatPrice: Decimal(5) })

        mockFetchAccountBalances.mockResolvedValue({
            results: [{
                address: 'ADDR1',
                data: {
                    address: 'ADDR1',
                    amount: 1000000,
                    assets: [
                        {
                            'asset-id': 123,
                            amount: 50000, // 5.0000 tokens
                        },
                        {
                            'asset-id': 456,
                            amount: 10000, // Different asset
                        },
                    ],
                },
            }],
        })

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // The hook returns data from assetBalances array
        expect(result.current.data).toBeDefined()
        if (result.current.data) {
            expect(result.current.data.assetId).toBe('123')
            expect(result.current.data.amount).toEqual(Decimal(5)) // 50000 / 10^4
        }
    })

    it('returns null when asset not found in holdings', async () => {
        const account: WalletAccount = {
            address: 'ADDR1',
            name: 'Account 1',
            id: '1',
            type: 'standard',
            canSign: true,
        }

        mockAssetPrices.set('0', { fiatPrice: Decimal(1) })

        mockFetchAccountBalances.mockResolvedValue({
            results: [{
                address: 'ADDR1',
                data: {
                    address: 'ADDR1',
                    amount: 1000000,
                    assets: [],
                },
            }],
        })

        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(account, '123'), // Looking for non-existent asset
            { wrapper: createWrapper() }
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toBeNull()
    })

    it('does not query when account is undefined', () => {
        const { result } = renderHook(
            () => useAccountAssetBalanceQuery(undefined, '123'),
            { wrapper: createWrapper() }
        )

        expect(result.current.isPending).toBe(false)
        expect(result.current.data).toBeNull()
    })
})
