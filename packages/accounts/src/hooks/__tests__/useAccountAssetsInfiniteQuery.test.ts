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
import { useAccountAssetsInfiniteQuery } from '../useAccountAssetsInfiniteQuery'

const mockGetAccountHoldingsPage = vi.fn()
vi.mock('../../db', () => ({
    getAccountHoldingsPage: (...args: unknown[]) =>
        mockGetAccountHoldingsPage(...args),
}))

// The first page self-heals an unsynced account before reading; stub it out.
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const mockAlgoPrices = new Map<string, { usdPrice: Decimal }>()
vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: '0',
    ALGO_ASSET: { assetId: '0', decimals: 6 },
    useAssetPricesQuery: () => ({ data: mockAlgoPrices }),
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountAssetsInfiniteQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAlgoPrices.clear()
    })

    it('maps the first page rows to balances and converts values to ALGO', async () => {
        mockAlgoPrices.set('0', { usdPrice: new Decimal(2) })
        mockGetAccountHoldingsPage.mockResolvedValue([
            {
                assetId: '0',
                amount: new Decimal(5_000_000),
                asset: { assetId: '0', decimals: 6, name: 'Algo' },
                usdPrice: new Decimal(2),
                isFavorited: false,
            },
            {
                assetId: '100',
                amount: new Decimal(1000),
                asset: { assetId: '100', decimals: 2, name: 'Token' },
                usdPrice: new Decimal(10),
                isFavorited: false,
            },
        ])

        const { result } = renderHook(
            () => useAccountAssetsInfiniteQuery('ADDR1'),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        const algo = result.current.balances.find(b => b.assetId === '0')
        expect(algo?.amount).toEqual(new Decimal(5)) // 5_000_000 / 10^6
        expect(algo?.algoValue).toEqual(new Decimal(5)) // ALGO is 1:1 in ALGO

        const token = result.current.balances.find(b => b.assetId === '100')
        expect(token?.amount).toEqual(new Decimal(10)) // 1000 / 10^2
        expect(token?.algoValue).toEqual(new Decimal(50)) // 10 * $10 / $2

        // Short page (< PAGE_SIZE) → no further pages.
        expect(result.current.hasNextPage).toBe(false)
    })

    it('passes sort, search and filters through to the DB read', async () => {
        mockGetAccountHoldingsPage.mockResolvedValue([])

        renderHook(
            () =>
                useAccountAssetsInfiniteQuery('ADDR1', {
                    sortMode: 'alphabeticalAsc',
                    search: 'algo',
                    filters: { hideZeroBalance: true },
                }),
            { wrapper: wrapper() },
        )

        await waitFor(() =>
            expect(mockGetAccountHoldingsPage).toHaveBeenCalled(),
        )
        expect(mockGetAccountHoldingsPage).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'alphabeticalAsc',
                search: 'algo',
                hideZeroBalance: true,
                limit: 30,
                offset: 0,
            }),
        )
    })

    it('emits zeros for holdings whose metadata has not synced', async () => {
        mockAlgoPrices.set('0', { usdPrice: new Decimal(1) })
        mockGetAccountHoldingsPage.mockResolvedValue([
            {
                assetId: '999',
                amount: new Decimal(1000),
                asset: null,
                usdPrice: null,
                isFavorited: false,
            },
        ])

        const { result } = renderHook(
            () => useAccountAssetsInfiniteQuery('ADDR1'),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const row = result.current.balances.find(b => b.assetId === '999')
        expect(row?.amount).toEqual(new Decimal(0))
        expect(row?.algoValue).toEqual(new Decimal(0))
        expect(row?.asset).toBeUndefined()
    })
})
