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
import { useAssetFiatPricesQuery } from '../useAssetFiatPricesQuery'
import Decimal from 'decimal.js'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { useAssetsStore } from '../../store'
import { ALGO_ASSET_ID } from '../../models'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetFiatPrices: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
}))

vi.mock('../endpoints', () => ({
    fetchAssetFiatPrices: mocks.fetchAssetFiatPrices,
    fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
}))

// Mock currencies
const mockUsdToPreferred = vi.fn((amount: Decimal) => amount.mul(2))
vi.mock('@perawallet/wallet-core-currencies', () => ({
    useCurrency: vi.fn(() => ({
        usdToPreferred: mockUsdToPreferred,
    })),
}))

// Mock store
vi.mock('../../store', async () => {
    const actual =
        await vi.importActual<typeof import('../../store')>('../../store')
    const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
    }
    return {
        ...actual,
        useAssetsStore: actual.createAssetsStore(mockStorage as any),
    }
})

describe('useAssetFiatPricesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        useAssetsStore.setState({ assetIDs: [] })
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        mockUsdToPreferred.mockImplementation((amount: Decimal) =>
            amount.mul(2),
        )
    })

    it('fetches and converts asset prices correctly', async () => {
        useAssetsStore.setState({ assetIDs: ['123'] })

        mocks.fetchAssetFiatPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetFiatPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data.size).toBe(2)
        expect(result.current.data.get(ALGO_ASSET_ID)?.fiatPrice).toEqual(
            new Decimal(3.0),
        ) // 1.5 * 2
        expect(result.current.data.get('123')?.fiatPrice).toEqual(
            new Decimal(4.0),
        ) // 2.0 * 2
    })

    it('filters out assets with null usd_value', async () => {
        useAssetsStore.setState({ assetIDs: ['456'] })

        mocks.fetchAssetFiatPrices.mockResolvedValue({
            results: [
                { asset_id: '456', usd_value: null }, // Should be handled gracefully, likely defaults to 0 or handled in mapper
            ],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetFiatPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // In mapper: Decimal(data.usd_value ?? '0') -> so it becomes 0
        expect(result.current.data.get('456')?.fiatPrice).toEqual(
            new Decimal(0),
        )
        expect(result.current.data.get(ALGO_ASSET_ID)?.fiatPrice).toEqual(
            new Decimal(3.0),
        )
    })

    it('handles loading state', () => {
        mocks.fetchAssetFiatPrices.mockReturnValue(new Promise(() => {}))
        mocks.fetchPublicAssetDetails.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useAssetFiatPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', async () => {
        useAssetsStore.setState({ assetIDs: ['123'] })

        mocks.fetchAssetFiatPrices.mockRejectedValue(new Error('Failed'))
        mocks.fetchPublicAssetDetails.mockResolvedValue({ usd_value: '1.0' })

        const { result } = renderHook(() => useAssetFiatPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
