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

const mocks = vi.hoisted(() => ({
    getAssetPricesByIds: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../../db', () => ({
    getAssetPricesByIds: mocks.getAssetPricesByIds,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

describe('useAssetPricesQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.getAssetPricesByIds.mockReturnValue([])
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    it('reads prices from the database and transforms them', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
            { assetId: ALGO_ASSET_ID, usdPrice: new Decimal('1.5') },
        ])

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

    it('handles assets with zero usd_value', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '456', usdPrice: new Decimal('0') },
        ])

        const { result } = renderHook(() => useAssetPricesQuery(['456']), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data.get('456')?.usdPrice).toEqual(new Decimal(0))
    })

    it('does not refetch when ids reference changes but content is the same', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useAssetPricesQuery(ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        const callCount = mocks.getAssetPricesByIds.mock.calls.length

        // Rerender with a new array reference containing the same content
        rerender({ ids: ['123'] })

        expect(mocks.getAssetPricesByIds.mock.calls.length).toBe(callCount)
    })

    it('refetches when ids content actually changes', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result, rerender } = renderHook(
            ({ ids }: { ids: string[] }) => useAssetPricesQuery(ids),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { ids: ['123'] },
            },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.getAssetPricesByIds.mockClear()

        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '456', usdPrice: new Decimal('3.0') },
        ])

        rerender({ ids: ['456'] })

        await waitFor(() =>
            expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
                assetIds: ['456'],
                network: 'mainnet',
            }),
        )
    })

    it('refetches when network changes', async () => {
        mocks.getAssetPricesByIds.mockReturnValue([
            { assetId: '123', usdPrice: new Decimal('2.0') },
        ])

        const { result } = renderHook(() => useAssetPricesQuery(['123']), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        mocks.getAssetPricesByIds.mockClear()

        // Switch to testnet
        mocks.useNetwork.mockReturnValue({ network: 'testnet' })

        const testnetQueryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const { result: result2 } = renderHook(
            () => useAssetPricesQuery(['123']),
            { wrapper: createWrapper(testnetQueryClient) },
        )

        await waitFor(() => expect(result2.current.isPending).toBe(false))

        expect(mocks.getAssetPricesByIds).toHaveBeenCalledWith({
            assetIds: ['123'],
            network: 'testnet',
        })
    })

    it('respects the enabled parameter', () => {
        renderHook(() => useAssetPricesQuery(['123'], false), {
            wrapper: createWrapper(queryClient),
        })

        expect(mocks.getAssetPricesByIds).not.toHaveBeenCalled()
    })
})
