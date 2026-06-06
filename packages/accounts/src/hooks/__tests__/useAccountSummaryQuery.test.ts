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

// The query self-heals an unsynced account before reading; stub it out.
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
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

    it('derives ALGO + USD totals from the split aggregate', async () => {
        mockAlgoPrices.set('0', { usdPrice: new Decimal(2) })
        // 10 ALGO + $80 of ASAs, ALGO @ $2.
        mockGetAccountPortfolioTotals.mockResolvedValue({
            algoAmount: new Decimal(10),
            nonAlgoUsdValue: new Decimal(80),
            holdingsCount: 5,
            missingMetadataCount: 0,
        })

        const { result } = renderHook(() => useAccountSummaryQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // USD: 80 + 10*$2 = 100. ALGO: 10 + 80/$2 = 50.
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(100))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(50))
        expect(result.current.holdingsCount).toBe(5)
        expect(result.current.isComplete).toBe(true)
    })

    it('is incomplete while held assets are still missing metadata', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue({
            algoAmount: new Decimal(10),
            nonAlgoUsdValue: new Decimal(0),
            holdingsCount: 50,
            missingMetadataCount: 12,
        })

        const { result } = renderHook(() => useAccountSummaryQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.isComplete).toBe(false)
    })

    it('is disabled (no query) without an address', () => {
        const { result } = renderHook(() => useAccountSummaryQuery(undefined), {
            wrapper: wrapper(),
        })
        expect(mockGetAccountPortfolioTotals).not.toHaveBeenCalled()
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
    })

    it('still shows the ALGO balance when the ALGO price is unknown', async () => {
        // No price entry for ALGO. ASAs can't be ALGO-denominated, but ALGO's
        // own amount is price-independent and must still surface.
        mockGetAccountPortfolioTotals.mockResolvedValue({
            algoAmount: new Decimal(10),
            nonAlgoUsdValue: new Decimal(80),
            holdingsCount: 5,
        })

        const { result } = renderHook(() => useAccountSummaryQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.portfolioAlgoValue).toEqual(new Decimal(10))
    })
})
