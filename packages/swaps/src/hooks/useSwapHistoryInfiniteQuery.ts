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
import { deploymentOf } from '@perawallet/wallet-core-config'
import { useDeviceIdLookup } from '@perawallet/wallet-core-device'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { fetchSwapHistory, routerAccountId, type SwapHistoryPage } from '../api'
import type { SwapAccountAddress, SwapHistoryItem, SwapStatus } from '../models'
import { isSwapHistoryRow } from '../utils/isSwapHistoryRow'
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
        results: page.results.filter(
            item =>
                isSwapHistoryRow(item) &&
                (!statuses || statuses.includes(item.status)),
        ),
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
 * ahead past pages it empties. The device and request scope come from the
 * first account; every account's address is asked for in one list, so an
 * order whose legs sit on two of them shows once.
 */
export const useSwapHistoryInfiniteQuery = (
    accounts: SwapAccountAddress[],
    statuses?: SwapStatus[],
    isEnabled: boolean = true,
): UseSwapHistoryInfiniteQueryResult => {
    const requestScope = accounts.at(0)?.scope ?? null
    const deviceId = useDeviceIdLookup()(
        requestScope ? deploymentOf(requestScope) : null,
    )
    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(accounts, statuses),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) => {
            if (!requestScope) throw new Error('No swap account to read')
            return fetchVisiblePage(
                cursor =>
                    fetchSwapHistory(
                        {
                            deviceId: deviceId ?? '',
                            accounts: accounts.map(account =>
                                routerAccountId(account.scope, account.address),
                            ),
                            cursor,
                            limit: PAGE_SIZE,
                        },
                        requestScope,
                    ),
                statuses,
                pageParam,
            )
        },
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: SwapHistoryPage) =>
            lastPage.next ?? undefined,
        enabled: isEnabled && requestScope !== null && !!deviceId,
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
