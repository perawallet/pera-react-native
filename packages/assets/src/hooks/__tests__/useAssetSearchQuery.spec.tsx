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
import { QueryClient, onlineManager } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAssetSearchQuery } from '../useAssetSearchQuery'
import { registerFakeAssetsAdapter } from '../../__tests__/fakeAssetsChain'
import { createWrapper } from './test-utils'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'

// Algorand switches its Pera-backed capabilities off on BetaNet and custom
// nodes, the networks only a developer-mode override reaches.
vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: vi.fn(() =>
        ['mainnet', 'testnet'].includes(
            mocks.useNetwork.mock.results.at(-1)?.value?.network ?? 'mainnet',
        ),
    ),
    useNetwork: mocks.useNetwork,
}))

const mocks = vi.hoisted(() => ({
    searchAssets: vi.fn(),
    useNetwork: vi.fn(),
}))

const mainnetScope = { chainId: 'algorand', networkId: 'mainnet' }

const makeResult = (assetId: number, name = `Asset ${assetId}`) => ({
    assetId: String(assetId),
    name,
    unitName: `A${assetId}`,
    peraMetadata: { verificationTier: 'verified' as const },
})

describe('useAssetSearchQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
        registerFakeAssetsAdapter({ searchAssets: mocks.searchAssets })
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    afterEach(() => {
        // onlineManager is a global singleton — restore connectivity so an
        // offline test can't leak into the next one.
        onlineManager.setOnline(true)
    })

    it('reports isPaused when offline (true-offline regime)', async () => {
        onlineManager.setOnline(false)

        const { result, unmount } = renderHook(
            () => useAssetSearchQuery('algo'),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.isPaused).toBe(true))
        // isLoading passes through TanStack's own definition (isPending &&
        // isFetching); while paused there is no active fetch, so isLoading
        // is false here — isPaused is the flag callers should branch on.
        expect(result.current.isLoading).toBe(false)
        expect(mocks.searchAssets).not.toHaveBeenCalled()

        // The query is still paused (never fetched) at this point. Tear it
        // down before `afterEach` restores connectivity — otherwise
        // restoring `onlineManager` resumes this now-orphaned query, which
        // re-invokes the (by-then unconfigured) mock in the background and
        // can surface as an unhandled rejection in a later test.
        unmount()
        queryClient.clear()
    })

    it('returns the adapter results', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeResult(123, 'USDC')],
            nextCursor: undefined,
        })

        const { result } = renderHook(() => useAssetSearchQuery('usdc'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(mocks.searchAssets).toHaveBeenCalledWith(
            { query: 'usdc', cursor: undefined, hasCollectible: false },
            mainnetScope,
        )
        expect(result.current.results).toEqual([makeResult(123, 'USDC')])
        expect(result.current.isError).toBe(false)
    })

    it('returns an empty results array before data has loaded', () => {
        mocks.searchAssets.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(() => useAssetSearchQuery('abc'), {
            wrapper: createWrapper(queryClient),
        })

        expect(result.current.results).toEqual([])
        expect(result.current.isLoading).toBe(true)
    })

    it('does not fetch when enabled is false', () => {
        renderHook(() => useAssetSearchQuery('anything', { enabled: false }), {
            wrapper: createWrapper(queryClient),
        })

        expect(mocks.searchAssets).not.toHaveBeenCalled()
    })

    it.each(['betanet', 'custom'])(
        'reports isUnavailableOnNetwork and skips the fetch on %s',
        network => {
            mocks.useNetwork.mockReturnValue({ network })

            const { result } = renderHook(() => useAssetSearchQuery('algo'), {
                wrapper: createWrapper(queryClient),
            })

            expect(result.current.isUnavailableOnNetwork).toBe(true)
            expect(useChainCapability).toHaveBeenCalledWith(
                'algorand',
                'assetSearch',
            )
            expect(mocks.searchAssets).not.toHaveBeenCalled()
        },
    )

    it.each(['mainnet', 'testnet'])(
        'reports isUnavailableOnNetwork false and fetches normally on %s',
        async network => {
            mocks.useNetwork.mockReturnValue({ network })
            mocks.searchAssets.mockResolvedValue({
                results: [],
                nextCursor: undefined,
            })

            const { result } = renderHook(() => useAssetSearchQuery('algo'), {
                wrapper: createWrapper(queryClient),
            })

            expect(result.current.isUnavailableOnNetwork).toBe(false)

            await waitFor(() => expect(mocks.searchAssets).toHaveBeenCalled())
        },
    )

    it('passes hasCollectible through to the endpoint', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [],
            nextCursor: undefined,
        })

        renderHook(() => useAssetSearchQuery('nft', { hasCollectible: true }), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() =>
            expect(mocks.searchAssets).toHaveBeenCalledWith(
                expect.objectContaining({ hasCollectible: true }),
                mainnetScope,
            ),
        )
    })

    it('propagates errors from the endpoint', async () => {
        mocks.searchAssets.mockRejectedValue(new Error('network down'))

        const { result } = renderHook(() => useAssetSearchQuery('oops'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.results).toEqual([])
    })

    it('exposes hasNextPage when the adapter returns a cursor', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeResult(1)],
            nextCursor: 'abc123',
        })

        const { result } = renderHook(() => useAssetSearchQuery('a'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.hasNextPage).toBe(true)
    })

    it('fetches the next page using the adapter cursor', async () => {
        mocks.searchAssets
            .mockResolvedValueOnce({
                results: [makeResult(1)],
                nextCursor: 'CURSOR_TOKEN',
            })
            .mockResolvedValueOnce({
                results: [makeResult(2)],
                nextCursor: undefined,
            })

        const { result } = renderHook(() => useAssetSearchQuery('a'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.hasNextPage).toBe(true)

        result.current.fetchNextPage()

        await waitFor(() =>
            expect(result.current.isFetchingNextPage).toBe(false),
        )

        expect(mocks.searchAssets).toHaveBeenNthCalledWith(
            2,
            { query: 'a', cursor: 'CURSOR_TOKEN', hasCollectible: false },
            mainnetScope,
        )
        expect(result.current.results.map(r => r.assetId)).toEqual(['1', '2'])
        expect(result.current.hasNextPage).toBe(false)
    })

    it('refetches when the query string changes', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [],
            nextCursor: undefined,
        })

        const { rerender } = renderHook(
            ({ q }: { q: string }) => useAssetSearchQuery(q),
            {
                wrapper: createWrapper(queryClient),
                initialProps: { q: 'foo' },
            },
        )

        await waitFor(() =>
            expect(mocks.searchAssets).toHaveBeenCalledWith(
                expect.objectContaining({ query: 'foo' }),
                mainnetScope,
            ),
        )

        rerender({ q: 'bar' })

        await waitFor(() =>
            expect(mocks.searchAssets).toHaveBeenCalledWith(
                expect.objectContaining({ query: 'bar' }),
                mainnetScope,
            ),
        )
    })
})
