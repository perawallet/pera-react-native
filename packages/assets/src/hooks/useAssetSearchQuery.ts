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

import { useInfiniteQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { searchAssets } from '../api/assets/search-endpoints'
import type { AssetSearchResultResponse } from '../api/assets/search-schema'
import { MODULE_PREFIX } from './querykeys'

type AssetSearchItem = {
    assetId: string
    name: string | null
    unitName: string | null
    logo: string | null
    verificationTier: 'verified' | 'unverified' | 'suspicious'
    usdValue: string | null
    type: string | null
}

type UseAssetSearchQueryResult = {
    results: AssetSearchItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
}

const transformSearchResult = (
    item: AssetSearchResultResponse,
): AssetSearchItem => ({
    assetId: String(item.asset_id),
    name: item.name ?? null,
    unitName: item.unit_name ?? null,
    logo: item.logo ?? null,
    verificationTier: item.verification_tier,
    usdValue: item.usd_value ?? null,
    type: item.type ?? null,
})

const getAssetSearchQueryKey = (query: string, network: string) => [
    MODULE_PREFIX,
    'search',
    { query, network },
]

const extractCursor = (
    nextUrl: string | null | undefined,
): string | undefined => {
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
): UseAssetSearchQueryResult => {
    const { network } = useNetwork()

    const infiniteQuery = useInfiniteQuery({
        queryKey: getAssetSearchQueryKey(query, network),
        queryFn: ({ pageParam }) =>
            searchAssets({
                query,
                network,
                cursor: pageParam,
            }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: lastPage => extractCursor(lastPage.next),
        enabled: query.length > 0,
    })

    const results =
        infiniteQuery.data?.pages.flatMap(page =>
            page.results.map(transformSearchResult),
        ) ?? []

    return {
        results,
        isLoading: infiniteQuery.isLoading,
        isError: infiniteQuery.isError,
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
        hasNextPage: infiniteQuery.hasNextPage,
        fetchNextPage: infiniteQuery.fetchNextPage,
    }
}

export type { AssetSearchItem, UseAssetSearchQueryResult }
