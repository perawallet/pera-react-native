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
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { fetchSwapPairs, type SwapPairsPage } from '../api'
import type { SwapAsset, SwapAssetRef } from '../models'
import { swapQueryKeys } from './querykeys'

const PAGE_SIZE = 50
// Bounds the skip-ahead over pages the scope filter empties, so a router that
// keeps answering with off-scope rows can't loop the query forever.
const MAX_SKIPPED_PAGES = 10

export type UseSwapPairsInfiniteQueryParams = {
    anchor: Nullable<SwapAssetRef>
    scope: ChainScope
    q?: string
    isEnabled?: boolean
}

export type UseSwapPairsInfiniteQueryResult = {
    assets: SwapAsset[]
    isLoading: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
}

const isOnScope = (asset: SwapAsset, scope: ChainScope): boolean =>
    asset.ref.chainId === scope.chainId &&
    asset.ref.networkId === scope.networkId

const fetchVisiblePage = async (
    anchor: SwapAssetRef,
    scope: ChainScope,
    q: Optional<string>,
    cursor: Optional<string>,
): Promise<SwapPairsPage> => {
    let page = await fetchSwapPairs({
        anchor,
        direction: 'source',
        q,
        cursor,
        limit: PAGE_SIZE,
    })
    for (let skipped = 0; skipped < MAX_SKIPPED_PAGES; skipped++) {
        const assets = page.assets.filter(asset => isOnScope(asset, scope))
        if (assets.length > 0 || page.next === null) {
            return { assets, next: page.next }
        }
        page = await fetchSwapPairs({
            anchor,
            direction: 'source',
            q,
            cursor: page.next,
            limit: PAGE_SIZE,
        })
    }
    return {
        assets: page.assets.filter(asset => isOnScope(asset, scope)),
        next: page.next,
    }
}

/** What `anchor` swaps into, on `scope` only. */
export const useSwapPairsInfiniteQuery = ({
    anchor,
    scope,
    q,
    isEnabled = true,
}: UseSwapPairsInfiniteQueryParams): UseSwapPairsInfiniteQueryResult => {
    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.pairs(anchor, q, scope),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) =>
            // `enabled` keeps a null anchor from ever reaching here.
            fetchVisiblePage(anchor as SwapAssetRef, scope, q, pageParam),
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: SwapPairsPage) =>
            lastPage.next ?? undefined,
        enabled: isEnabled && anchor !== null,
    })

    return {
        assets: query.data?.pages.flatMap(page => page.assets) ?? [],
        isLoading: query.isLoading,
        hasNextPage: query.hasNextPage,
        fetchNextPage: () => void query.fetchNextPage(),
    }
}
