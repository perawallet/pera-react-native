import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useAssetPriceHistory,
    AssetPriceHistoryQueryKey,
    AssetPriceHistoryRequest,
} from '../useAssetPriceHistory'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock fetch
const mockFetchFn = vi.hoisted(() => vi.fn())
vi.mock('../../query-client', () => ({
    default: mockFetchFn,
}))

// Mock Zod schema to pass through data
vi.mock('../../zod/assetPriceChartDataResponse', () => ({
    assetPriceChartDataResponseSchema: {
        parse: (data: any) => data,
    },
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

describe('useAssetPriceHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('AssetPriceHistoryQueryKey', () => {
        it('generates correct query key', () => {
            const params = { asset_id: 123, period: 'one-day' as const }
            const key = AssetPriceHistoryQueryKey(params)
            expect(key).toEqual([
                { url: '/v1/assets/price-chart/' },
                params,
            ])
        })
    })

    describe('AssetPriceHistoryRequest', () => {
        it('calls fetch with correct parameters', async () => {
            const params = { asset_id: 123, period: 'one-day' as const }
            const mockResponse = { data: [] }
            mockFetchFn.mockResolvedValue(mockResponse)

            const result = await AssetPriceHistoryRequest({ params })

            expect(mockFetchFn).toHaveBeenCalledWith({
                backend: 'pera',
                method: 'GET',
                url: '/v1/assets/price-chart/',
                params,
            })
            expect(result).toEqual(mockResponse.data)
        })
    })

    describe('useAssetPriceHistory hook', () => {
        it('fetches data successfully', async () => {
            const params = { asset_id: 123, period: 'one-day' as const }
            const mockData = [{ timestamp: 1, value: 10 }]
            mockFetchFn.mockResolvedValue({ data: mockData })

            const { result } = renderHook(
                () => useAssetPriceHistory({ params }),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockData)
        })
    })
})
