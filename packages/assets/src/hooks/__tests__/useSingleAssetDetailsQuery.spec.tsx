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
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ChainAdapterNotRegisteredError } from '@perawallet/wallet-core-chain-contract'
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { useSingleAssetDetailsQuery } from '../useSingleAssetDetailsQuery'
import { getRemoteAssetDetailsQueryKey } from '../querykeys'
import { assetsChainAdapters } from '../../chain-adapter'
import {
    FAKE_NATIVE_ASSET,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { createWrapper } from './test-utils'

const mocks = vi.hoisted(() => ({
    useNetwork: vi.fn(),
    getAssetById: vi.fn(),
    batchEnqueue: vi.fn(),
    fetchAsset: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

vi.mock('../../db', () => ({
    getAssetById: mocks.getAssetById,
}))

vi.mock('../../services/assetBatchQueue', () => ({
    assetBatchQueue: { enqueue: mocks.batchEnqueue },
}))

const mainnetScope = { chainId: 'algorand', networkId: 'mainnet' }

const makeAsset = (assetId: string, name: string) => ({
    assetId,
    decimals: 6,
    creator: { address: 'ADDR' },
    totalSupply: new Decimal(1000),
    name,
    unitName: 'TEST',
})

describe('useSingleAssetDetailsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        mocks.getAssetById.mockResolvedValue(null)
        // Default: the bulk endpoint doesn't know the asset, so the read falls
        // through to the adapter's per-asset read.
        mocks.batchEnqueue.mockResolvedValue(undefined)
        mocks.fetchAsset.mockImplementation(async (assetId: string) =>
            makeAsset(assetId, 'Adapter Asset'),
        )
        registerFakeAssetsAdapter({ fetchAsset: mocks.fetchAsset })
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        // Restore the global onlineManager singleton so offline state set by a
        // test can't leak into subsequent tests.
        onlineManager.setOnline(true)
    })

    it('serves asset details from SQLite while offline', async () => {
        onlineManager.setOnline(false)
        const dbAsset = makeAsset('123', 'Offline DB Asset')
        mocks.getAssetById.mockResolvedValue(dbAsset)

        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toEqual(dbAsset)
        expect(mocks.getAssetById).toHaveBeenCalledWith({
            assetId: '123',
            network: 'mainnet',
        })
    })

    it('reads asset from DB without asking the adapter', async () => {
        const dbAsset = makeAsset('123', 'DB Asset')
        mocks.getAssetById.mockResolvedValue(dbAsset)

        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toEqual(dbAsset)
        expect(mocks.batchEnqueue).not.toHaveBeenCalled()
        expect(mocks.fetchAsset).not.toHaveBeenCalled()
    })

    it("returns the adapter's native asset when it is not in the DB yet", async () => {
        const { result } = renderHook(
            () => useSingleAssetDetailsQuery(FAKE_NATIVE_ASSET.assetId),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toBe(FAKE_NATIVE_ASSET)
        expect(mocks.batchEnqueue).not.toHaveBeenCalled()
        expect(mocks.fetchAsset).not.toHaveBeenCalled()
    })

    it('resolves a DB miss through the batch queue without the per-asset read', async () => {
        const bulkAsset = makeAsset('456', 'Bulk Asset')
        mocks.batchEnqueue.mockResolvedValue(bulkAsset)

        const { result } = renderHook(() => useSingleAssetDetailsQuery('456'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data).toEqual(bulkAsset)
        expect(mocks.batchEnqueue).toHaveBeenCalledWith('456', 'mainnet')
        expect(mocks.fetchAsset).not.toHaveBeenCalled()
    })

    it("falls back to the adapter's per-asset read when the batch queue finds nothing", async () => {
        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data?.name).toBe('Adapter Asset')
        expect(mocks.fetchAsset).toHaveBeenCalledWith('123', mainnetScope)
    })

    it('skips DB and batch queue entirely with useDB=false and caches under the remote key', async () => {
        const { result } = renderHook(
            () => useSingleAssetDetailsQuery('789', false),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(result.current.data?.name).toBe('Adapter Asset')
        expect(mocks.getAssetById).not.toHaveBeenCalled()
        expect(mocks.batchEnqueue).not.toHaveBeenCalled()
        expect(
            queryClient.getQueryData(
                getRemoteAssetDetailsQueryKey('789', 'mainnet'),
            ),
        ).toBeDefined()
    })

    it('handles loading state', () => {
        mocks.getAssetById.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.isLoading).toBe(true)
    })

    it('surfaces an adapter failure as a query error', async () => {
        mocks.fetchAsset.mockRejectedValue(new Error('adapter down'))

        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('adapter down')
    })

    it('ends in ChainAdapterNotRegisteredError on a DB miss when no adapter is registered', async () => {
        assetsChainAdapters.reset()

        const { result } = renderHook(() => useSingleAssetDetailsQuery('123'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(
            ChainAdapterNotRegisteredError,
        )
    })
})
