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
import { Decimal } from 'decimal.js'
import { useAssetMarketDataQuery } from '../useAssetMarketDataQuery'
import { createWrapper } from './test-utils'

const ETHEREUM_MAINNET = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    getAssetPricesByIds: vi.fn(),
    getPriceMissAssetIds: vi.fn(),
}))

vi.mock('../../db', () => ({
    getAssetPricesByIds: mocks.getAssetPricesByIds,
    getPriceMissAssetIds: mocks.getPriceMissAssetIds,
}))

describe('useAssetMarketDataQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getAssetPricesByIds.mockResolvedValue([])
        mocks.getPriceMissAssetIds.mockResolvedValue([])
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

    it('reports no market data for a recorded miss with no price row', async () => {
        mocks.getPriceMissAssetIds.mockResolvedValue(['0xabc'])

        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(result.current.hasNoMarketData).toBe(true))
    })

    it('reports market data when a price row exists, even with a miss', async () => {
        mocks.getPriceMissAssetIds.mockResolvedValue(['0xabc'])
        mocks.getAssetPricesByIds.mockResolvedValue([
            { assetId: '0xabc', usdPrice: new Decimal('1.5') },
        ])

        const { result } = render(ETHEREUM_MAINNET)

        await waitFor(() => expect(queryClient.isFetching()).toBe(0))
        expect(mocks.getPriceMissAssetIds).toHaveBeenCalledTimes(1)
        expect(result.current.hasNoMarketData).toBe(false)
    })

    it('stays unknown when there is neither a price nor a miss', async () => {
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
        expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
            assetIds: ['0xabc'],
            scope: ALGORAND_MAINNET,
        })
    })
})
