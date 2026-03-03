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

vi.mock('@perawallet/wallet-extension-network', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useAssetPricesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    it('fetches and stores raw USD asset prices', async () => {
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetPricesQuery(['123']), {
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
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '456', usd_value: null }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetPricesQuery(['456']), {
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

        const { result } = renderHook(() => useAssetPricesQuery(['123']), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isPending).toBe(true)
    })

    it('handles error state', async () => {
        mocks.fetchAssetPrices.mockRejectedValue(new Error('Failed'))
        mocks.fetchPublicAssetDetails.mockResolvedValue({ usd_value: '1.0' })

        const { result } = renderHook(() => useAssetPricesQuery(['123']), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('does not refetch when ids reference changes but content is the same', async () => {
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useAssetPricesQuery(ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const fetchCount = mocks.fetchAssetPrices.mock.calls.length

        // Rerender with a new array reference containing the same content
        rerender({ ids: ['123'] })

        expect(mocks.fetchAssetPrices.mock.calls.length).toBe(fetchCount)
    })

    it('refetches when ids content actually changes', async () => {
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useAssetPricesQuery(ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.fetchAssetPrices.mockClear()

        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '456', usd_value: '3.0' }],
            next: null,
            previous: null,
        })

        rerender({ ids: ['456'] })

        await waitFor(() =>
            expect(mocks.fetchAssetPrices).toHaveBeenCalledWith(
                ['456'],
                'mainnet',
            ),
        )
    })

    it('refetches when network changes', async () => {
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '2.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '1.5',
        })

        const { result } = renderHook(() => useAssetPricesQuery(['123']), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.fetchAssetPrices.mockClear()
        mocks.fetchPublicAssetDetails.mockClear()

        // Switch to testnet
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })
        mocks.fetchAssetPrices.mockResolvedValue({
            results: [{ asset_id: '123', usd_value: '1.0' }],
            next: null,
            previous: null,
        })
        mocks.fetchPublicAssetDetails.mockResolvedValue({
            usd_value: '0.5',
        })

        const testnetQueryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { result: result2 } = renderHook(
            () => useAssetPricesQuery(['123']),
            { wrapper: createWrapper(testnetQueryClient) },
        )

        await waitFor(() => expect(result2.current.isPending).toBe(false))

        expect(mocks.fetchAssetPrices).toHaveBeenCalledWith(['123'], 'testnet')
    })

    it('respects the enabled parameter', () => {
        mocks.fetchAssetPrices.mockReturnValue(new Promise(() => {}))
        mocks.fetchPublicAssetDetails.mockReturnValue(new Promise(() => {}))

        renderHook(() => useAssetPricesQuery(['123'], false), {
            wrapper: createWrapper(queryClient),
        })

        expect(mocks.fetchAssetPrices).not.toHaveBeenCalled()
        expect(mocks.fetchPublicAssetDetails).not.toHaveBeenCalled()
    })
})
