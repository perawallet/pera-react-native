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

import { useInfiniteQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    searchAssetsAcrossScopes,
    type ScopedAssetSearchCursors,
    type ScopedAssetSearchResult,
} from '../chain-adapter'
import { MODULE_PREFIX } from './querykeys'

type UseAssetSearchAcrossScopesQueryOptions = {
    hasCollectible?: boolean
    /** Skip the query entirely when false. Defaults to true. */
    enabled?: boolean
}

type UseAssetSearchAcrossScopesQueryResult = {
    results: ScopedAssetSearchResult[]
    isLoading: boolean
    isError: boolean
    /** The failure behind `isError`, for callers that branch on its kind; null otherwise. */
    error: unknown
    /** True when the query is paused because the device is offline. */
    isPaused: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    /** A scope's search failed on a page loaded so far, so its hits are missing. */
    isIncomplete: boolean
}

const getAssetSearchAcrossScopesQueryKey = (
    query: string,
    scopes: readonly ChainScope[],
    hasCollectible: boolean,
) => [MODULE_PREFIX, 'search-across-scopes', { query, scopes, hasCollectible }]

/**
 * Callers pass only scopes whose chain can search assets; one that can't is
 * left out of every page, as if it had nothing to find.
 */
export const useAssetSearchAcrossScopesQuery = (
    query: string,
    scopes: readonly ChainScope[],
    options?: UseAssetSearchAcrossScopesQueryOptions,
): UseAssetSearchAcrossScopesQueryResult => {
    const hasCollectible = options?.hasCollectible ?? false

    const infiniteQuery = useInfiniteQuery({
        queryKey: getAssetSearchAcrossScopesQueryKey(
            query,
            scopes,
            hasCollectible,
        ),
        queryFn: ({ pageParam }) =>
            searchAssetsAcrossScopes(
                { query, cursors: pageParam, hasCollectible },
                scopes,
            ),
        enabled: (options?.enabled ?? true) && scopes.length > 0,
        initialPageParam: undefined as Optional<ScopedAssetSearchCursors>,
        getNextPageParam: lastPage => lastPage.nextCursors,
    })

    return {
        results: infiniteQuery.data?.pages.flatMap(page => page.results) ?? [],
        isLoading: infiniteQuery.isLoading,
        isError: infiniteQuery.isError,
        error: infiniteQuery.error ?? null,
        isPaused: infiniteQuery.fetchStatus === 'paused',
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
        hasNextPage: infiniteQuery.hasNextPage,
        fetchNextPage: () => void infiniteQuery.fetchNextPage(),
        isIncomplete:
            infiniteQuery.data?.pages.some(
                page => page.failedScopes.length > 0,
            ) ?? false,
    }
}

export type { UseAssetSearchAcrossScopesQueryResult }
