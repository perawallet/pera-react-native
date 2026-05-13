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
import type { Optional } from '@perawallet/wallet-core-shared'
import { fetchSwapHistory } from '../api'
import type { SwapHistoryItem } from '../models'
import { swapQueryKeys } from './querykeys'

const PAGE_SIZE = 20

type FetchSwapHistoryResult = Awaited<ReturnType<typeof fetchSwapHistory>>

export type UseSwapHistoryInfiniteQueryResult = {
    swaps: SwapHistoryItem[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Error | null
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

// API returns the next page as a full URL — we only need the cursor query param.
const extractCursor = (
    nextUrl: string | null | undefined,
): Optional<string> => {
    if (!nextUrl) return undefined
    try {
        return new URL(nextUrl).searchParams.get('cursor') ?? undefined
    } catch {
        return undefined
    }
}

export const useSwapHistoryInfiniteQuery = (
    address: string,
    statuses?: string,
    enabled: boolean = true,
): UseSwapHistoryInfiniteQueryResult => {
    const { network } = useNetwork()

    const query = useInfiniteQuery({
        queryKey: swapQueryKeys.historyInfinite(address, statuses, network),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) =>
            fetchSwapHistory(address, network, statuses, pageParam, PAGE_SIZE),
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: FetchSwapHistoryResult) =>
            extractCursor(lastPage.next),
        enabled: enabled && address.length > 0,
    })

    const swaps = query.data?.pages.flatMap(page => page.results) ?? []

    return {
        swaps,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage ?? false,
        fetchNextPage: query.fetchNextPage,
        refetch: query.refetch,
    }
}
