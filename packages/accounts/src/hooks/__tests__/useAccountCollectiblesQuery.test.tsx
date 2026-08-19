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

import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { Decimal } from 'decimal.js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAccountCollectiblesQuery } from '../useAccountCollectiblesQuery'

const mockGetAccountCollectiblesLite = vi.fn()
vi.mock('../../db', () => ({
    getAccountCollectiblesLite: (...args: unknown[]) =>
        mockGetAccountCollectiblesLite(...args),
}))
vi.mock('../../sync/account-syncer', () => ({
    ensureAccountFetched: vi.fn(() => Promise.resolve()),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const wrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

const makeRow = (assetId: string, title: string) => ({
    assetId,
    amount: new Decimal(1),
    decimals: 0,
    creatorAddress: 'CREATOR',
    totalSupply: '1',
    name: `Asset ${title}`,
    unitName: 'NFT',
    url: null,
    metadata: null,
    peraMetadataJson: null,
    title,
    collectionName: null,
})

describe('useAccountCollectiblesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads the rows SQL sorted for the requested mode', async () => {
        const rows = [makeRow('100', 'Aardvark'), makeRow('200', 'Zebra')]
        mockGetAccountCollectiblesLite.mockResolvedValue(rows)

        const { result } = renderHook(
            () =>
                useAccountCollectiblesQuery('ADDR1', { sortMode: 'titleAsc' }),
            { wrapper: wrapper() },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.collectibles).toEqual(rows)
        expect(mockGetAccountCollectiblesLite).toHaveBeenCalledWith(
            expect.objectContaining({
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'titleAsc',
            }),
        )
    })

    // PERA-4921: the sort mode is part of the key, so re-sorting starts a cold
    // query. Blanking the gallery until SQL answers is what read as "sorting
    // does nothing" on a freshly imported account.
    describe('placeholder rows while a new request resolves', () => {
        it('holds the previous order for the same account and network', async () => {
            const ascending = [makeRow('100', 'Aardvark')]
            mockGetAccountCollectiblesLite.mockResolvedValue(ascending)

            const { result, rerender } = renderHook(
                ({ sortMode }: { sortMode: 'titleAsc' | 'titleDesc' }) =>
                    useAccountCollectiblesQuery('ADDR1', { sortMode }),
                { wrapper: wrapper(), initialProps: { sortMode: 'titleAsc' } },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            const descending = [makeRow('200', 'Zebra')]
            let resolveDescending: (rows: unknown) => void = () => {}
            mockGetAccountCollectiblesLite.mockReturnValue(
                new Promise(resolve => {
                    resolveDescending = resolve
                }),
            )
            rerender({ sortMode: 'titleDesc' })

            // Still on screen, flagged as belonging to the previous request.
            expect(result.current.collectibles).toEqual(ascending)
            expect(result.current.isPlaceholderData).toBe(true)
            expect(result.current.isPending).toBe(false)

            resolveDescending(descending)

            await waitFor(() =>
                expect(result.current.isPlaceholderData).toBe(false),
            )
            expect(result.current.collectibles).toEqual(descending)
        })

        it('never shows another account rows while its read is in flight', async () => {
            mockGetAccountCollectiblesLite.mockResolvedValue([
                makeRow('100', 'Aardvark'),
            ])

            const { result, rerender } = renderHook(
                ({ address }: { address: string }) =>
                    useAccountCollectiblesQuery(address),
                { wrapper: wrapper(), initialProps: { address: 'ADDR1' } },
            )

            await waitFor(() => expect(result.current.isPending).toBe(false))

            mockGetAccountCollectiblesLite.mockReturnValue(
                new Promise(() => {}),
            )
            rerender({ address: 'ADDR2' })

            expect(result.current.collectibles).toEqual([])
            expect(result.current.isPlaceholderData).toBe(false)
            expect(result.current.isPending).toBe(true)
        })
    })
})
