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

/** The router has no status filter, so `statuses` narrows the loaded rows. */
export const useSwapHistoryInfiniteQuery = (
    address: string,
    scope: ChainScope,
    statuses?: SwapStatus[],
    isEnabled: boolean = true,
): UseSwapHistoryInfiniteQueryResult => {
    const deviceId = useDeviceIdLookup()(deploymentOf(scope))
    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(address, scope),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) =>
            fetchSwapHistory(
                {
                    deviceId: deviceId ?? '',
                    accounts: [routerAccountId(scope, address)],
                    cursor: pageParam,
                    limit: PAGE_SIZE,
                },
                scope,
            ),
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: SwapHistoryPage) =>
            lastPage.next ?? undefined,
        enabled: isEnabled && address.length > 0 && !!deviceId,
    })

    const loaded = query.data?.pages.flatMap(page => page.results) ?? []
    const swaps = statuses
        ? loaded.filter(item => statuses.includes(item.status))
        : loaded

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
