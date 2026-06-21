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

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, beforeEach, vi } from 'vitest'

const ALGO_ASSET = { assetId: 0, name: 'Algorand', unitName: 'ALGO' }

const mocks = vi.hoisted(() => ({
    useAssetsQuery: vi.fn(),
    getAllHeldAssetIdsForNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    ALGO_ASSET_ID: 0,
    ALGO_ASSET: { assetId: 0, name: 'Algorand', unitName: 'ALGO' },
    useAssetsQuery: mocks.useAssetsQuery,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../db', () => ({
    getAllHeldAssetIdsForNetwork: mocks.getAllHeldAssetIdsForNetwork,
}))

import { useOwnedAssets } from '../useOwnedAssets'

const USDC = { assetId: 31566704, name: 'USD Coin', unitName: 'USDC' }

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.useAssetsQuery.mockReturnValue({
        data: new Map([[0, ALGO_ASSET]]),
        isPending: false,
    })
})

describe('useOwnedAssets', () => {
    it('always includes ALGO plus the held assets whose metadata is cached', async () => {
        mocks.getAllHeldAssetIdsForNetwork.mockResolvedValue([31566704])
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([
                [0, ALGO_ASSET],
                [31566704, USDC],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useOwnedAssets(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.assets).toHaveLength(2)
        })
        expect(result.current.assets.map(a => a.assetId)).toEqual([0, 31566704])
    })

    it('omits held assets whose metadata is not yet cached', async () => {
        mocks.getAllHeldAssetIdsForNetwork.mockResolvedValue([99999])
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([[0, ALGO_ASSET]]),
            isPending: false,
        })

        const { result } = renderHook(() => useOwnedAssets(), {
            wrapper: createWrapper(),
        })

        // Assert inside waitFor so it reflects the post-resolution state, not
        // the initial empty list (which would pass trivially with just ALGO).
        await waitFor(() =>
            expect(result.current.assets.map(a => a.assetId)).toEqual([0]),
        )
    })

    it('does not duplicate ALGO when it appears in the held-asset ids', async () => {
        mocks.getAllHeldAssetIdsForNetwork.mockResolvedValue([0, 31566704])
        mocks.useAssetsQuery.mockReturnValue({
            data: new Map([
                [0, ALGO_ASSET],
                [31566704, USDC],
            ]),
            isPending: false,
        })

        const { result } = renderHook(() => useOwnedAssets(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.assets).toHaveLength(2))
        expect(result.current.assets.map(a => a.assetId)).toEqual([0, 31566704])
    })

    it('does not query held ids and is not loading when disabled', () => {
        const { result } = renderHook(
            () => useOwnedAssets({ enabled: false }),
            {
                wrapper: createWrapper(),
            },
        )

        expect(mocks.getAllHeldAssetIdsForNetwork).not.toHaveBeenCalled()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.assets.map(a => a.assetId)).toEqual([0])
    })
})
