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
import React from 'react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccountSummaryQuery } from '../useAccountSummaryQuery'

const mockGetAccountPortfolioTotals = vi.fn()
vi.mock('../../db', () => ({
    getAccountPortfolioTotals: (...args: unknown[]) =>
        mockGetAccountPortfolioTotals(...args),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const mockAlgoPrices = new Map<string, { usdPrice: Decimal }>()
vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    useAssetPricesQuery: () => ({ data: mockAlgoPrices }),
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountSummaryQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAlgoPrices.clear()
    })

    it('exposes the SQL portfolio total and derives the ALGO-denominated value', async () => {
        mockAlgoPrices.set('0', { usdPrice: new Decimal(2) })
        mockGetAccountPortfolioTotals.mockResolvedValue({
            totalUsdValue: new Decimal(100),
            holdingsCount: 5,
        })

        const { result } = renderHook(() => useAccountSummaryQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.portfolioUsdValue).toEqual(new Decimal(100))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(50)) // 100 / $2
        expect(result.current.holdingsCount).toBe(5)
    })

    it('is disabled (no query) without an address', () => {
        const { result } = renderHook(() => useAccountSummaryQuery(undefined), {
            wrapper: wrapper(),
        })
        expect(mockGetAccountPortfolioTotals).not.toHaveBeenCalled()
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
    })

    it('reports zero ALGO value when the ALGO price is unknown', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue({
            totalUsdValue: new Decimal(100),
            holdingsCount: 1,
        })

        const { result } = renderHook(() => useAccountSummaryQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(0))
    })
})
