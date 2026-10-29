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
import { useAccountAssetsQuery } from '../useAccountAssetsQuery'

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const SOURCE = { address: 'ADDR1', scope: SCOPE }
const ETH_SOURCE = {
    address: '0xADDR',
    scope: { chainId: 'ethereum', networkId: 'mainnet' } as ChainScope,
}

const mockGetAccountHoldingsLite = vi.fn()
vi.mock('../../db', () => ({
    getAccountHoldingsLite: (...args: unknown[]) =>
        mockGetAccountHoldingsLite(...args),
}))
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))
const NATIVE_ASSET = vi.hoisted(() => ({ assetId: '0', decimals: 6 }))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => NATIVE_ASSET,
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

    // Restore the global onlineManager singleton so an offline test can't leak
    // its state into subsequent tests.
    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('serves holdings from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        const rows = [
            {
                assetId: '0',
                amount: new Decimal(5_000_000),
                decimals: 6,
                chainData: null,
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

        const { result } = renderHook(() => useAccountAssetsQuery([SOURCE]), {
            wrapper: wrapper(),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.holdings).toEqual(rows)
    })

    it('returns the lite holdings rows in one unbounded read', async () => {
        const rows = [
            {
                assetId: '0',
                amount: new Decimal(5_000_000),
                decimals: 6,
                chainData: null,
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

        const { result } = renderHook(() => useAccountAssetsQuery([SOURCE]), {
            wrapper: wrapper(),
        })

        expect(result.current.isPending).toBe(true)
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
                useAccountAssetsQuery([SOURCE], {
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
                sources: [SOURCE],
                sortMode: 'alphabeticalAsc',
                search: 'algo',
                hideZeroBalance: true,
            }),
        )
    })

    it('does not read when there are no sources', async () => {
        const { result } = renderHook(() => useAccountAssetsQuery([]), {
            wrapper: wrapper(),
        })

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(mockGetAccountHoldingsLite).not.toHaveBeenCalled()
        expect(result.current.holdings).toEqual([])
        expect(result.current.isPending).toBe(false)
    })

    it('holds the previous rows while the search changes over the same sources', async () => {
        const rows = [{ assetId: '0' }]
        mockGetAccountHoldingsLite.mockResolvedValueOnce(rows)
        const { result, rerender } = renderHook(
            ({ search }: { search: string }) =>
                useAccountAssetsQuery([SOURCE, ETH_SOURCE], { search }),
            { wrapper: wrapper(), initialProps: { search: '' } },
        )
        await waitFor(() => expect(result.current.holdings).toEqual(rows))
        mockGetAccountHoldingsLite.mockReturnValueOnce(new Promise(() => {}))

        rerender({ search: 'al' })

        expect(result.current.isPlaceholderData).toBe(true)
        expect(result.current.holdings).toEqual(rows)
    })

    it('drops the previous rows when the sources change', async () => {
        const rows = [{ assetId: '0' }]
        mockGetAccountHoldingsLite.mockResolvedValueOnce(rows)
        const { result, rerender } = renderHook(
            ({ sources }: { sources: (typeof SOURCE)[] }) =>
                useAccountAssetsQuery(sources),
            {
                wrapper: wrapper(),
                initialProps: { sources: [SOURCE, ETH_SOURCE] },
            },
        )
        await waitFor(() => expect(result.current.holdings).toEqual(rows))
        mockGetAccountHoldingsLite.mockReturnValueOnce(new Promise(() => {}))

        rerender({ sources: [ETH_SOURCE] })

        expect(result.current.isPlaceholderData).toBe(false)
        expect(result.current.holdings).toEqual([])
    })
})
