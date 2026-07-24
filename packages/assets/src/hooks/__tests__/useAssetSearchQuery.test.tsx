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
import { createWrapper } from './test-utils'

const mocks = vi.hoisted(() => ({
    searchAssets: vi.fn(),
    useNetwork: vi.fn(),
}))

vi.mock('../../api/assets/search-endpoints', () => ({
    searchAssets: mocks.searchAssets,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mocks.useNetwork,
}))

const makeApiResult = (
    assetId: number,
    overrides: Partial<{
        name: string | null
        unit_name: string | null
        logo: string | null
        verification_tier: 'verified' | 'unverified' | 'suspicious'
        usd_value: string | null
        type: 'algo' | 'standard_asset' | 'dapp_asset' | 'collectible' | null
        collectible: {
            title?: string | null
            primary_image?: string | null
            collection?: { name?: string | null } | null
        } | null
    }> = {},
) => ({
    asset_id: assetId,
    name: overrides.name ?? `Asset ${assetId}`,
    unit_name: overrides.unit_name ?? `A${assetId}`,
    logo: overrides.logo ?? null,
    verification_tier: overrides.verification_tier ?? 'verified',
    usd_value: overrides.usd_value ?? '1.00',
    type: overrides.type ?? 'standard_asset',
    collectible: overrides.collectible ?? null,
})

describe('useAssetSearchQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.useNetwork.mockReturnValue({ network: 'mainnet' })
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

    it('fetches and transforms results from the API', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeApiResult(123, { name: 'USDC', unit_name: 'USDC' })],
            next: null,
        })

        const { result } = renderHook(() => useAssetSearchQuery('usdc'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(mocks.searchAssets).toHaveBeenCalledWith({
            query: 'usdc',
            network: 'mainnet',
            cursor: undefined,
            hasCollectible: false,
        })
        expect(result.current.results).toEqual([
            expect.objectContaining({
                assetId: '123',
                name: 'USDC',
                unitName: 'USDC',
                peraMetadata: expect.objectContaining({
                    verificationTier: 'verified',
                }),
            }),
        ])
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

    it('passes hasCollectible through to the endpoint', async () => {
        mocks.searchAssets.mockResolvedValue({ results: [], next: null })

        renderHook(() => useAssetSearchQuery('nft', { hasCollectible: true }), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() =>
            expect(mocks.searchAssets).toHaveBeenCalledWith(
                expect.objectContaining({ hasCollectible: true }),
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

    it('exposes hasNextPage when the API returns a next url', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeApiResult(1)],
            next: 'https://api.example.com/v1/assets/search/?cursor=abc123',
        })

        const { result } = renderHook(() => useAssetSearchQuery('a'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.hasNextPage).toBe(true)
    })

    it('fetches the next page using the cursor extracted from the next url', async () => {
        mocks.searchAssets
            .mockResolvedValueOnce({
                results: [makeApiResult(1)],
                next: 'https://api.example.com/v1/assets/search/?cursor=CURSOR_TOKEN',
            })
            .mockResolvedValueOnce({
                results: [makeApiResult(2)],
                next: null,
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

        expect(mocks.searchAssets).toHaveBeenNthCalledWith(2, {
            query: 'a',
            network: 'mainnet',
            cursor: 'CURSOR_TOKEN',
            hasCollectible: false,
        })
        expect(result.current.results.map(r => r.assetId)).toEqual(['1', '2'])
        expect(result.current.hasNextPage).toBe(false)
    })

    it('treats a malformed next url as no more pages', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeApiResult(1)],
            next: 'not a url',
        })

        const { result } = renderHook(() => useAssetSearchQuery('a'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.hasNextPage).toBe(false)
    })

    it('treats a next url without a cursor param as no more pages', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [makeApiResult(1)],
            next: 'https://api.example.com/v1/assets/search/?limit=25',
        })

        const { result } = renderHook(() => useAssetSearchQuery('a'), {
            wrapper: createWrapper(queryClient),
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.hasNextPage).toBe(false)
    })

    it('refetches when the query string changes', async () => {
        mocks.searchAssets.mockResolvedValue({ results: [], next: null })

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
            ),
        )

        rerender({ q: 'bar' })

        await waitFor(() =>
            expect(mocks.searchAssets).toHaveBeenCalledWith(
                expect.objectContaining({ query: 'bar' }),
            ),
        )
    })

    it('transforms collectible fields from the API response', async () => {
        mocks.searchAssets.mockResolvedValue({
            results: [
                makeApiResult(42, {
                    type: 'collectible',
                    collectible: {
                        title: 'Pera #42',
                        primary_image: 'https://img/42.png',
                        collection: { name: 'Pera Collection' },
                    },
                }),
            ],
            next: null,
        })

        const { result } = renderHook(
            () => useAssetSearchQuery('pera', { hasCollectible: true }),
            { wrapper: createWrapper(queryClient) },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(result.current.results[0]).toEqual(
            expect.objectContaining({
                assetId: '42',
                peraMetadata: expect.objectContaining({
                    type: 'collectible',
                    collectible: {
                        title: 'Pera #42',
                        primaryImage: 'https://img/42.png',
                        collection: { name: 'Pera Collection' },
                    },
                }),
            }),
        )
    })
})
