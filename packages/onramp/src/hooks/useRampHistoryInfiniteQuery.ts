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

import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { isNotFoundError, type Optional } from '@perawallet/wallet-core-shared'

import { getRampHistory, getRampHistoryByUrl } from '../api'
import type { RampHistoryPage } from '../api/history/transformers'
import type { OnrampStatus, RampHistoryItem } from '../models'
import { onrampQueryKeys } from './querykeys'

// While orders settle the list polls every 10s; on a 404 (the backend has not
// yet materialised a history record for this device/account) it backs off to
// 60s to avoid hammering an endpoint that is expected to be empty.
const POLL_INTERVAL_MS = 10_000
const NOT_FOUND_POLL_INTERVAL_MS = 60_000

// Exported so the backoff decision is directly unit-testable without having
// to drive a full TanStack Query refetch cycle through the hook.
export const getRampHistoryRefetchIntervalMs = (
    error: unknown,
    isActive: boolean,
): number | false => {
    if (!isActive) return false
    return isNotFoundError(error) ? NOT_FOUND_POLL_INTERVAL_MS : POLL_INTERVAL_MS
}

export type UseRampHistoryInfiniteQueryParams = {
    deviceId: string
    accountAddress: string
    status?: OnrampStatus
    /**
     * When false, the query stops polling (it stays enabled, so cached data
     * still shows). Use it to poll only while the History tab is visible.
     * Defaults to true.
     */
    isActive?: boolean
}

export type UseRampHistoryInfiniteQueryResult = {
    items: RampHistoryItem[]
    isLoading: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Error | null
    hasNextPage: boolean
    fetchNextPage: () => void
    refetch: () => void
}

export const useRampHistoryInfiniteQuery = ({
    deviceId,
    accountAddress,
    status,
    isActive = true,
}: UseRampHistoryInfiniteQueryParams): UseRampHistoryInfiniteQueryResult => {
    const { network } = useNetwork()

    const query = useInfiniteQuery({
        queryKey: onrampQueryKeys.history(
            deviceId,
            accountAddress,
            status,
            network,
        ),
        queryFn: ({ pageParam }: { pageParam: Optional<string> }) =>
            pageParam
                ? getRampHistoryByUrl(pageParam, network)
                : getRampHistory({ deviceId, accountAddress, status }, network),
        initialPageParam: undefined as Optional<string>,
        getNextPageParam: (lastPage: RampHistoryPage) =>
            lastPage.next ?? undefined,
        enabled: Boolean(deviceId && accountAddress),
        refetchInterval: currentQuery =>
            getRampHistoryRefetchIntervalMs(currentQuery.state.error, isActive),
    })

    // Stable identity while pages are unchanged — consumers feed this to lists.
    const items = useMemo(
        () => query.data?.pages.flatMap(page => page.results) ?? [],
        [query.data],
    )

    return {
        items,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage ?? false,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
