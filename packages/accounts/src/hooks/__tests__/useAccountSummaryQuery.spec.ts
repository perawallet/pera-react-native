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
import React from 'react'
import { Decimal } from 'decimal.js'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useAccountSummaryQuery } from '../useAccountSummaryQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }

const mockGetAccountPortfolioTotals = vi.fn()
vi.mock('../../db', () => ({
    getAccountPortfolioTotals: (...args: unknown[]) =>
        mockGetAccountPortfolioTotals(...args),
}))

// The query self-heals an unsynced account before reading; stub it out.
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))

const capability = vi.hoisted(() => ({ pricing: true }))
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: (_chainId: string, name: string) =>
        name === 'pricing' ? capability.pricing : true,
}))

const totals = (overrides: Record<string, unknown> = {}) => ({
    nativeAmount: new Decimal(10),
    nativeUsdPrice: new Decimal(2),
    nonNativeUsdValue: new Decimal(80),
    holdingsCount: 5,
    missingMetadataCount: 0,
    ...overrides,
})

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
        capability.pricing = true
    })

    // Restore the global onlineManager singleton so an offline test can't leak
    // its state into subsequent tests.
    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('serves the portfolio summary from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        mockGetAccountPortfolioTotals.mockResolvedValue(totals())

        const { result } = renderHook(
            () => useAccountSummaryQuery('ADDR1', SCOPE),
            {
                wrapper: wrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.portfolioUsdValue).toEqual(new Decimal(100))
        expect(result.current.holdingsCount).toBe(5)
    })

    it('derives native + USD totals from the split aggregate', async () => {
        // 10 native + $80 of other holdings, native @ $2.
        mockGetAccountPortfolioTotals.mockResolvedValue(totals())

        const { result } = renderHook(
            () => useAccountSummaryQuery('ADDR1', SCOPE),
            {
                wrapper: wrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // USD: 80 + 10*$2 = 100. Native: 10 + 80/$2 = 50.
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(100))
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(50))
        expect(result.current.holdingsCount).toBe(5)
        expect(result.current.isComplete).toBe(true)
    })

    it('is incomplete while held assets are still missing metadata', async () => {
        mockGetAccountPortfolioTotals.mockResolvedValue(
            totals({
                nonNativeUsdValue: new Decimal(0),
                holdingsCount: 50,
                missingMetadataCount: 12,
            }),
        )

        const { result } = renderHook(
            () => useAccountSummaryQuery('ADDR1', SCOPE),
            {
                wrapper: wrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.isComplete).toBe(false)
    })

    it('is disabled (no query) without an address', () => {
        const { result } = renderHook(
            () => useAccountSummaryQuery(undefined, SCOPE),
            {
                wrapper: wrapper(),
            },
        )
        expect(mockGetAccountPortfolioTotals).not.toHaveBeenCalled()
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(0))
    })

    it('still shows the native balance when its price is unknown', async () => {
        // No price for the native asset. Other holdings can't be expressed in
        // native terms, but its own amount is price-independent and must still
        // surface.
        mockGetAccountPortfolioTotals.mockResolvedValue(
            totals({ nativeUsdPrice: null }),
        )

        const { result } = renderHook(
            () => useAccountSummaryQuery('ADDR1', SCOPE),
            {
                wrapper: wrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.nativeAmount).toEqual(new Decimal(10))
        expect(result.current.portfolioNativeValue).toEqual(new Decimal(10))
        expect(result.current.portfolioUsdValue).toBeNull()
    })

    it('reports a USD value for an unpriced native balance on a chain with no price source', async () => {
        capability.pricing = false
        mockGetAccountPortfolioTotals.mockResolvedValue(
            totals({ nativeUsdPrice: null }),
        )

        const { result } = renderHook(
            () => useAccountSummaryQuery('ADDR1', SCOPE),
            {
                wrapper: wrapper(),
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.portfolioUsdValue).toEqual(new Decimal(80))
    })
})
