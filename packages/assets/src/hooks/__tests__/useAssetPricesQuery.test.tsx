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
import { useAssetPricesQuery } from '../useAssetPricesQuery'
import Decimal from 'decimal.js'
import { createWrapper } from './test-utils'
import { QueryClient } from '@tanstack/react-query'
import { useAssetsStore } from '../../store'
import { ALGO_ASSET_ID } from '../../models'

// Mock endpoints
const mocks = vi.hoisted(() => ({
    fetchAssetPrices: vi.fn(),
    fetchPublicAssetDetails: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../../api', async importOriginal => {
    const actual = await importOriginal<typeof import('../../api')>()
    return {
        ...actual,
        fetchAssetPrices: mocks.fetchAssetPrices,
        fetchPublicAssetDetails: mocks.fetchPublicAssetDetails,
    }
})

vi.mock(
    '@perawallet/wallet-core-platform-integration',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@perawallet/wallet-core-platform-integration')
            >()
        return {
            ...actual,
            useNetwork: mocks.useNetwork,
        }
    },
)

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

describe('useAssetPricesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        useAssetsStore.setState({ assetIDs: [] })
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    it('fetches and stores raw USD asset prices', async () => {
        useAssetsStore.setState({ assetIDs: ['123'] })

        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data.size).toBe(2)
        expect(result.current.data.get(ALGO_ASSET_ID)?.usdPrice).toEqual(
            new Decimal(1.5),
        )
        expect(result.current.data.get('123')?.usdPrice).toEqual(
            new Decimal(2.0),
        )
    })

    it('handles assets with null usd_value', async () => {
        useAssetsStore.setState({ assetIDs: ['456'] })

        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '456', usd_value: null }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        // In transformer: Decimal(data.usd_value ?? '0') -> so it becomes 0
        expect(result.current.data.get('456')?.usdPrice).toEqual(new Decimal(0))
        expect(result.current.data.get(ALGO_ASSET_ID)?.usdPrice).toEqual(
            new Decimal(1.5),
        )
    })

    it('handles loading state', () => {
        mocks.fetchAssetPrices.mockReturnValue(new Promise(() => {}))
        mocks.fetchPublicAssetDetails.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useAssetPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', async () => {
        useAssetsStore.setState({ assetIDs: ['123'] })

        mocks.fetchAssetPrices.mockRejectedValue(new Error('Failed'))
        mocks.fetchPublicAssetDetails.mockResolvedValue({ usd_value: '1.0' })

        const { result } = renderHook(() => useAssetPricesQuery(), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
