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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '../../models'

const mockEnqueue = vi.hoisted(() => vi.fn())

vi.mock('../../services/assetBatchQueue', () => ({
    assetBatchQueue: { enqueue: mockEnqueue },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

import { useAssetByIdQuery } from '../useAssetByIdQuery'

const ASSET_ID = '12345'

const sampleAsset: PeraAsset = {
    assetId: ASSET_ID,
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal(1000),
    name: 'alpha',
    unitName: 'ALPHA',
}

describe('useAssetByIdQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        mockEnqueue.mockReset().mockResolvedValue(undefined)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('returns the asset resolved by the batch queue', async () => {
        mockEnqueue.mockResolvedValue(sampleAsset)

        const { result } = renderHook(() => useAssetByIdQuery(ASSET_ID), {
            wrapper,
        })

        await waitFor(() => expect(result.current.data).toEqual(sampleAsset))
        expect(mockEnqueue).toHaveBeenCalledTimes(1)
        expect(mockEnqueue).toHaveBeenCalledWith(ASSET_ID, 'mainnet')
    })

    it('returns null when the queue resolves with undefined', async () => {
        mockEnqueue.mockResolvedValue(undefined)

        const { result } = renderHook(() => useAssetByIdQuery(ASSET_ID), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))
        expect(result.current.data).toBeNull()
    })

    it('calls enqueue synchronously inside queryFn (no awaits before it)', async () => {
        // Regression guard for the batching bug: if the hook ever introduces
        // an `await` before `enqueue`, microtask flushes can fire between
        // concurrent rows and the queue stops batching.
        let resolveFirst!: (v: unknown) => void
        const firstPromise = new Promise(resolve => {
            resolveFirst = resolve
        })
        mockEnqueue
            .mockImplementationOnce(() => firstPromise)
            .mockImplementationOnce(() => Promise.resolve(sampleAsset))

        renderHook(() => useAssetByIdQuery('1'), { wrapper })
        renderHook(() => useAssetByIdQuery('2'), { wrapper })

        await waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(2))

        resolveFirst(sampleAsset)
    })

    it('does not query when enabled is false', () => {
        renderHook(() => useAssetByIdQuery(ASSET_ID, { enabled: false }), {
            wrapper,
        })
        expect(mockEnqueue).not.toHaveBeenCalled()
    })
})
