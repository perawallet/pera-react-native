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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import { searchAssets } from '../api/assets/search-endpoints'
import type { DisplayableAsset } from '../models/assets'
import { transformSearchResult } from './mappers'
import { MODULE_PREFIX } from './querykeys'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'

type UseAssetSearchQueryOptions = {
    hasCollectible?: boolean
    /** Skip the query entirely when false. Defaults to true. */
    enabled?: boolean
}

type UseAssetSearchQueryResult = {
    results: DisplayableAsset[]
    isLoading: boolean
    isError: boolean
    /** True when the query is paused because the device is offline
     *  (`fetchStatus === 'paused'`), instead of actively pending. */
    isPaused: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    /** True when the active network has no Pera backend — this can never succeed here. */
    isUnavailableOnNetwork: boolean
}

const getAssetSearchQueryKey = (
    query: string,
    network: string,
    hasCollectible: boolean,
) => [MODULE_PREFIX, 'search', { query, network, hasCollectible }]

const extractCursor = (nextUrl: Maybe<string>): Optional<string> => {
    if (!nextUrl) {
        return undefined
    }
    try {
        const url = new URL(nextUrl)
        return url.searchParams.get('cursor') ?? undefined
    } catch {
        return undefined
    }
}

export const useAssetSearchQuery = (
    query: string,
    options?: UseAssetSearchQueryOptions,
): UseAssetSearchQueryResult => {
    const { network } = useNetwork()
    const hasCollectible = options?.hasCollectible ?? false
    const isUnavailableOnNetwork = !isPeraBackedNetwork(network)
    const enabled = (options?.enabled ?? true) && !isUnavailableOnNetwork

    const infiniteQuery = useInfiniteQuery({
        queryKey: getAssetSearchQueryKey(query, network, hasCollectible),
        queryFn: ({ pageParam }) =>
            searchAssets({
                query,
                network,
                cursor: pageParam,
                hasCollectible,
            }),
        enabled,
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: lastPage => extractCursor(lastPage.next),
    })

    const results =
        infiniteQuery.data?.pages.flatMap(page =>
            page.results.map(transformSearchResult),
        ) ?? []

    return {
        results,
        isLoading: infiniteQuery.isLoading,
        isError: infiniteQuery.isError,
        isPaused: infiniteQuery.fetchStatus === 'paused',
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
        hasNextPage: infiniteQuery.hasNextPage,
        fetchNextPage: () => void infiniteQuery.fetchNextPage(),
        isUnavailableOnNetwork,
    }
}

export type { UseAssetSearchQueryResult }
