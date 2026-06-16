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
import { useAccountAssetsQuery } from '../useAccountAssetsQuery'

const mockGetAccountHoldingsLite = vi.fn()
vi.mock('../../db', () => ({
    getAccountHoldingsLite: (...args: unknown[]) =>
        mockGetAccountHoldingsLite(...args),
}))
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))
vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET: { assetId: '0', decimals: 6 },
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useAccountAssetsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns the lite holdings rows in one unbounded read', async () => {
        const rows = [
            {
                assetId: '0',
                amount: new Decimal(5_000_000),
                decimals: 6,
                creatorAddress: null,
                totalSupply: '1',
                name: 'Algo',
                unitName: 'ALGO',
                url: null,
                metadata: null,
                peraMetadataJson: null,
                isFavorited: false,
                usdPrice: new Decimal(2),
            },
        ]
        mockGetAccountHoldingsLite.mockResolvedValue(rows)

        const { result } = renderHook(() => useAccountAssetsQuery('ADDR1'), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // The list query reads everything in one pass (FlashList virtualizes),
        // so no limit/offset is passed.
        const call = mockGetAccountHoldingsLite.mock.calls[0][0]
        expect(call.limit).toBeUndefined()
        expect(call.offset).toBeUndefined()

        // Rows are returned as-is — materialization is deferred to the rows.
        expect(result.current.holdings).toEqual(rows)
    })

    it('passes sort, search and filters through to the DB read', async () => {
        mockGetAccountHoldingsLite.mockResolvedValue([])

        renderHook(
            () =>
                useAccountAssetsQuery('ADDR1', {
                    sortMode: 'alphabeticalAsc',
                    search: 'algo',
                    filters: { hideZeroBalance: true },
                }),
            { wrapper: wrapper() },
        )

        await waitFor(() =>
            expect(mockGetAccountHoldingsLite).toHaveBeenCalled(),
        )
        expect(mockGetAccountHoldingsLite).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'alphabeticalAsc',
                search: 'algo',
                hideZeroBalance: true,
            }),
        )
    })
})
