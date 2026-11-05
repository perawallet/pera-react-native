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
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useSwapPairsInfiniteQuery } from '../useSwapPairsInfiniteQuery'
import { fetchSwapPairs } from '../../api'
import type { SwapAsset } from '../../models'

vi.mock('../../api', () => ({ fetchSwapPairs: vi.fn() }))

const SCOPE: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ANCHOR = { ...SCOPE, assetId: 'native' }

const ETH_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

const asset = (
    assetId: string,
    networkId = 'mainnet',
    chainId: ChainId = 'algorand',
): SwapAsset => ({
    ref: { chainId, networkId, assetId },
    assetId,
    verificationTier: 'verified',
    crossChainAssetGroup: null,
})

function createWrapper() {
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

describe('swaps/useSwapPairsInfiniteQuery', () => {
    beforeEach(() => {
        vi.mocked(fetchSwapPairs).mockReset()
    })

    test('lists what the anchor swaps into, on the scope only', async () => {
        vi.mocked(fetchSwapPairs).mockResolvedValueOnce({
            assets: [asset('7'), asset('8', 'testnet')],
            next: null,
        })

        const { result } = renderHook(
            () => useSwapPairsInfiniteQuery({ anchor: ANCHOR, scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchSwapPairs).toHaveBeenCalledWith(
            expect.objectContaining({ anchor: ANCHOR, direction: 'source' }),
        )
        expect(result.current.assets.map(a => a.assetId)).toEqual(['7'])
    })

    test('pages past a page the scope filter empties', async () => {
        vi.mocked(fetchSwapPairs)
            .mockResolvedValueOnce({ assets: [], next: 'c2' })
            .mockResolvedValueOnce({
                assets: [asset('8', 'testnet')],
                next: 'c3',
            })
            .mockResolvedValueOnce({ assets: [asset('9')], next: null })

        const { result } = renderHook(
            () => useSwapPairsInfiniteQuery({ anchor: ANCHOR, scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() =>
            expect(result.current.assets.map(a => a.assetId)).toEqual(['9']),
        )
        expect(
            vi
                .mocked(fetchSwapPairs)
                .mock.calls.map(([params]) => params.cursor),
        ).toEqual([undefined, 'c2', 'c3'])
        expect(result.current.hasNextPage).toBe(false)
    })

    test('fetches the next page on demand', async () => {
        vi.mocked(fetchSwapPairs)
            .mockResolvedValueOnce({ assets: [asset('7')], next: 'c2' })
            .mockResolvedValueOnce({ assets: [asset('8')], next: null })

        const { result } = renderHook(
            () => useSwapPairsInfiniteQuery({ anchor: ANCHOR, scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.hasNextPage).toBe(true))
        await act(async () => {
            result.current.fetchNextPage()
        })

        await waitFor(() => expect(result.current.assets).toHaveLength(2))
    })

    test('waits for an anchor', () => {
        renderHook(
            () => useSwapPairsInfiniteQuery({ anchor: null, scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        expect(fetchSwapPairs).not.toHaveBeenCalled()
    })

    test('keeps a pair on any destination scope it is given', async () => {
        vi.mocked(fetchSwapPairs).mockResolvedValueOnce({
            assets: [
                asset('7'),
                asset('native', 'mainnet', 'ethereum'),
                asset('8', 'testnet'),
            ],
            next: null,
        })

        const { result } = renderHook(
            () =>
                useSwapPairsInfiniteQuery({
                    anchor: ANCHOR,
                    scope: SCOPE,
                    destinationScopes: [SCOPE, ETH_SCOPE],
                }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.assets.map(a => a.ref.chainId)).toEqual([
            'algorand',
            'ethereum',
        ])
    })

    test('drops a pair on another chain by default', async () => {
        vi.mocked(fetchSwapPairs).mockResolvedValueOnce({
            assets: [asset('7'), asset('native', 'mainnet', 'ethereum')],
            next: null,
        })

        const { result } = renderHook(
            () => useSwapPairsInfiniteQuery({ anchor: ANCHOR, scope: SCOPE }),
            { wrapper: createWrapper() },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.assets.map(a => a.assetId)).toEqual(['7'])
    })
})
