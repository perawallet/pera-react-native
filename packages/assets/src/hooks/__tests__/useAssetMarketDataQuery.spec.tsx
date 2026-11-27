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
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { useAssetMarketDataQuery } from '../useAssetMarketDataQuery'
import { createWrapper } from './test-utils'

const ETHEREUM_MAINNET = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    getPriceMissAssetIds: vi.fn(),
    fetchAndPersistPrices: vi.fn(),
}))

vi.mock('../../db', () => ({
    getPriceMissAssetIds: mocks.getPriceMissAssetIds,
}))

vi.mock('../../sync/price-syncer', () => ({
    fetchAndPersistPrices: mocks.fetchAndPersistPrices,
}))

describe('useAssetMarketDataQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getPriceMissAssetIds.mockResolvedValue([])
        mocks.fetchAndPersistPrices.mockResolvedValue(undefined)
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    const render = (scope: typeof ETHEREUM_MAINNET | typeof ALGORAND_MAINNET) =>
        renderHook(() => useAssetMarketDataQuery(scope, '0xabc'), {
            wrapper: createWrapper(queryClient),
        })

    it('reports no market data for a recorded miss', async () => {
        mocks.getPriceMissAssetIds.mockResolvedValue(['0xabc'])

        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(result.current.hasNoMarketData).toBe(true))
    })

    it('asks the price source about the asset before reading its miss', async () => {
        const order: string[] = []
        mocks.fetchAndPersistPrices.mockImplementation(async () => {
            order.push('fetch')
        })
        mocks.getPriceMissAssetIds.mockImplementation(async () => {
            order.push('read')
            return []
        })

        render(ETHEREUM_MAINNET)

        await waitFor(() => expect(order).toEqual(['fetch', 'read']))
        expect(mocks.fetchAndPersistPrices).toHaveBeenCalledWith(
            ['0xabc'],
            ETHEREUM_MAINNET,
        )
    })

    it('reads the stored miss when the price source cannot be asked', async () => {
        mocks.fetchAndPersistPrices.mockRejectedValue(new Error('offline'))
        mocks.getPriceMissAssetIds.mockResolvedValue(['0xabc'])

        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(result.current.hasNoMarketData).toBe(true))
    })

    it('stays unknown when there is no recorded miss', async () => {
        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(queryClient.isFetching()).toBe(0))
        expect(mocks.getPriceMissAssetIds).toHaveBeenCalledTimes(1)
        expect(result.current.hasNoMarketData).toBe(false)
    })

    it('is false before the read resolves', () => {
        mocks.getPriceMissAssetIds.mockReturnValue(new Promise(() => {}))

        const { result } = render(ETHEREUM_MAINNET)

        expect(result.current.hasNoMarketData).toBe(false)
    })

    it('resolves while offline', async () => {
        onlineManager.setOnline(false)
        mocks.getPriceMissAssetIds.mockResolvedValue(['0xabc'])

        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(result.current.hasNoMarketData).toBe(true))
    })

    it('reads in the scope it is given', async () => {
        render(ALGORAND_MAINNET)

        await waitFor(() =>
            expect(mocks.getPriceMissAssetIds).toHaveBeenCalledWith({
                assetIds: ['0xabc'],
                scope: ALGORAND_MAINNET,
            }),
        )
        expect(mocks.fetchAndPersistPrices).toHaveBeenCalledWith(
            ['0xabc'],
            ALGORAND_MAINNET,
        )
    })
})
