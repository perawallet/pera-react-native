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
import { useAccountBalancesQuery } from '../useAccountBalancesQuery'
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

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: new Map(),
        isPending: false,
    })),
    useAssetFiatPricesQuery: vi.fn(() => ({
        data: new Map(),
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
})
