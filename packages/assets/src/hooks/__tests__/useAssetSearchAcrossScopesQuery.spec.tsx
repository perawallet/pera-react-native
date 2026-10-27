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

import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { assetsChainAdapters } from '../../chain-adapter'
import {
    fakeAssetsAdapter,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { useAssetSearchAcrossScopesQuery } from '../useAssetSearchAcrossScopesQuery'
import { createWrapper } from './test-utils'

const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETHEREUM: ChainScope = {
    chainId: 'ethereum' as ChainId,
    networkId: 'mainnet',
}

const asset = (assetId: string) => ({ assetId, name: `Asset ${assetId}` })

describe('useAssetSearchAcrossScopesQuery', () => {
    const algorandSearch = vi.fn()
    const ethereumSearch = vi.fn()
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeAssetsAdapter({ search: algorandSearch })
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                chainId: 'ethereum' as ChainId,
                search: ethereumSearch,
            }),
        )
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    it("merges every scope's hits, each with its scope, and pages on while a scope has more", async () => {
        algorandSearch
            .mockResolvedValueOnce({ results: [asset('1')], nextCursor: 'A2' })
            .mockResolvedValueOnce({
                results: [asset('2')],
                nextCursor: undefined,
            })
        ethereumSearch.mockResolvedValue({
            results: [asset('native')],
            nextCursor: undefined,
        })

        const { result } = renderHook(
            () => useAssetSearchAcrossScopesQuery('usd', [ALGORAND, ETHEREUM]),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.results).toHaveLength(2))
        expect(result.current.results).toEqual([
            { scope: ALGORAND, asset: asset('1') },
            { scope: ETHEREUM, asset: asset('native') },
        ])
        expect(result.current.hasNextPage).toBe(true)

        act(() => result.current.fetchNextPage())

        await waitFor(() => expect(result.current.results).toHaveLength(3))
        expect(result.current.results[2]).toEqual({
            scope: ALGORAND,
            asset: asset('2'),
        })
        expect(result.current.hasNextPage).toBe(false)
        expect(ethereumSearch).toHaveBeenCalledTimes(1)
    })

    it('passes the collectible flag to every scope', async () => {
        algorandSearch.mockResolvedValue({ results: [], nextCursor: undefined })
        ethereumSearch.mockResolvedValue({ results: [], nextCursor: undefined })

        renderHook(
            () =>
                useAssetSearchAcrossScopesQuery('ape', [ALGORAND, ETHEREUM], {
                    hasCollectible: true,
                }),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(ethereumSearch).toHaveBeenCalled())
        expect(algorandSearch).toHaveBeenCalledWith(
            { query: 'ape', cursor: undefined, hasCollectible: true },
            ALGORAND,
        )
        expect(ethereumSearch).toHaveBeenCalledWith(
            { query: 'ape', cursor: undefined, hasCollectible: true },
            ETHEREUM,
        )
    })

    it('reports the failure when every scope fails', async () => {
        const failure = new Error('down')
        algorandSearch.mockRejectedValue(failure)
        ethereumSearch.mockRejectedValue(new Error('also down'))

        const { result } = renderHook(
            () => useAssetSearchAcrossScopesQuery('usd', [ALGORAND, ETHEREUM]),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBe(failure)
        expect(result.current.results).toEqual([])
    })

    it('runs nothing with no scopes or when disabled', async () => {
        const { result: noScopes } = renderHook(
            () => useAssetSearchAcrossScopesQuery('usd', []),
            { wrapper: createWrapper(queryClient) },
        )
        const { result: disabled } = renderHook(
            () =>
                useAssetSearchAcrossScopesQuery('usd', [ALGORAND], {
                    enabled: false,
                }),
            { wrapper: createWrapper(queryClient) },
        )

        expect(noScopes.current.results).toEqual([])
        expect(disabled.current.isLoading).toBe(false)
        expect(algorandSearch).not.toHaveBeenCalled()
    })
})
