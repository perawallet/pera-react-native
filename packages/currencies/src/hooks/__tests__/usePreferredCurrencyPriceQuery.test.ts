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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePreferredCurrencyPriceQuery } from '../usePreferredCurrencyPriceQuery'
import React from 'react'
import Decimal from 'decimal.js'

// Mock the network hook
const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: mockUseNetwork,
}))

// Mock the fetch function
const mockFetchCurrency = vi.hoisted(() => vi.fn())
vi.mock('../endpoints', () => ({
    fetchCurrency: mockFetchCurrency,
}))

describe('usePreferredCurrencyPriceQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        React.createElement(QueryClientProvider, { client: queryClient }, children)
    )

    it('fetches and transforms currency price', async () => {
        const mockData = {
            currency_id: 'EUR',
            usd_value: '0.85',
        }

        mockFetchCurrency.mockResolvedValue(mockData)

        const { result } = renderHook(() => usePreferredCurrencyPriceQuery('EUR'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual({
            id: 'EUR',
            usdPrice: Decimal('0.85'),
        })
    })

    it('uses correct network and currency', async () => {
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
        mockFetchCurrency.mockResolvedValue({ currency_id: 'GBP', usd_value: '1.25' })

        renderHook(() => usePreferredCurrencyPriceQuery('GBP'), { wrapper })

        await waitFor(() => expect(mockFetchCurrency).toHaveBeenCalledWith('testnet', 'GBP'))
    })

    it('handles null usd_value', async () => {
        const mockData = {
            currency_id: 'JPY',
            usd_value: null,
        }

        mockFetchCurrency.mockResolvedValue(mockData)

        const { result } = renderHook(() => usePreferredCurrencyPriceQuery('JPY'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.usdPrice).toEqual(Decimal('0'))
    })

    it('handles loading state', () => {
        mockFetchCurrency.mockImplementation(() => new Promise(() => { }))

        const { result } = renderHook(() => usePreferredCurrencyPriceQuery('USD'), { wrapper })

        expect(result.current.isPending).toBe(true)
    })

    it('transforms different currency values correctly', async () => {
        const mockData = {
            currency_id: 'CAD',
            usd_value: '0.73',
        }

        mockFetchCurrency.mockResolvedValue(mockData)

        const { result } = renderHook(() => usePreferredCurrencyPriceQuery('CAD'), { wrapper })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data?.id).toBe('CAD')
        expect(result.current.data?.usdPrice.toString()).toBe('0.73')
    })
})
