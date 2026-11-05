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
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { fetchSwapHistory, routerAccountId, type SwapHistoryPage } from '../api'
import type { SwapHistoryItem, SwapStatus } from '../models'
import { swapQueryKeys } from './querykeys'

const PAGE_SIZE = 20
// Bounds the read-ahead over pages the status filter empties, so a history of
// only hidden rows can't loop the query forever.
const MAX_SKIPPED_PAGES = 10

export type UseSwapHistoryInfiniteQueryResult = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

const fetchVisiblePage = async (
    fetchPage: (cursor: Optional<string>) => Promise<SwapHistoryPage>,
    statuses: Optional<SwapStatus[]>,
    cursor: Optional<string>,
): Promise<SwapHistoryPage> => {
    const visibleOf = (page: SwapHistoryPage): SwapHistoryPage => ({
        results: statuses
            ? page.results.filter(item => statuses.includes(item.status))
            : page.results,
        next: page.next,
    })
    let page = await fetchPage(cursor)
    for (let skipped = 0; skipped < MAX_SKIPPED_PAGES; skipped++) {
        const visible = visibleOf(page)
        if (visible.results.length > 0 || page.next === null) return visible
        page = await fetchPage(page.next)
    }
    return visibleOf(page)
}

/**
 * The router has no status filter, so `statuses` narrows each page, reading
 * ahead past pages it empties.
 */
export const useSwapHistoryInfiniteQuery = (
    address: string,
    scope: ChainScope,
    statuses?: SwapStatus[],
    isEnabled: boolean = true,
): UseSwapHistoryInfiniteQueryResult => {
    const deviceId = useDeviceIdLookup()(deploymentOf(scope))
    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(address, scope, statuses),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) =>
            fetchVisiblePage(
                cursor =>
                    fetchSwapHistory(
                        {
                            deviceId: deviceId ?? '',
                            accounts: [routerAccountId(scope, address)],
                            cursor,
                            limit: PAGE_SIZE,
                        },
                        scope,
                    ),
                statuses,
                pageParam,
            ),
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: SwapHistoryPage) =>
            lastPage.next ?? undefined,
        enabled: isEnabled && address.length > 0 && !!deviceId,
    })

    const swaps = query.data?.pages.flatMap(page => page.results) ?? []

    return {
        swaps,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
