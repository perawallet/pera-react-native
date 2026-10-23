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

import { useCallback, useEffect, useMemo } from 'react'
import {
    useInfiniteQuery,
    useQueryClient,
    onlineManager,
} from '@tanstack/react-query'
import type {
    ChainScope,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import {
    isoDateToUnixSeconds,
    PeraNetworkError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    getPendingTransactionRecords,
    getTransactionHistoryWithPending,
} from '../pending-history'
import { transactionQueryKeys } from './querykeys'

export type UseTransactionRecordsQueryParams = {
    accountAddress: string
    scope: ChainScope
    /** Kept client-side: the records backends take no asset filter. */
    assetId?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    beforeTime?: string
    isEnabled?: boolean
}

export type UseTransactionRecordsQueryResult = {
    /** Newest first, across every loaded page. */
    records: TransactionRecord[]
    isLoading: boolean
    /** See `UseTransactionHistoryQueryResult.isFetched`. */
    isFetched: boolean
    isFetching: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    /**
     * Nothing to show after {@link MAX_AUTO_RECORD_FETCHES} page fetches, with
     * history left: the hook stopped reading until `fetchNextPage` resumes it.
     */
    isSearchPaused: boolean
    fetchNextPage: () => void
    refetch: () => void
}

type RecordsPage = {
    records: TransactionRecord[]
    next: Nullable<PageRef>
}

/**
 * Backend pages one page fetch reads looking for a record the filters keep.
 * Bounded so a long filtered stretch loads in steps: a failure keeps what was
 * read, and an unmount stops it.
 */
export const MAX_RECORD_PAGE_READS = 5

/** Page fetches the hook makes on its own while nothing has loaded, per resume. */
export const MAX_AUTO_RECORD_FETCHES = 4

const involvesAsset = (record: TransactionRecord, assetId: string): boolean =>
    record.summary.amount?.assetRef.assetId === assetId ||
    (record.summary.balanceChanges ?? []).some(
        change => change.assetRef.assetId === assetId,
    )

const unixMsOf = (isoDate?: string): Optional<number> => {
    const seconds = isoDateToUnixSeconds(isoDate)
    return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * History for a chain that keeps no cached rows (see `hasCachedHistoryRows`),
 * read page by page from the chain's `getTransactionHistory` with the wallet's
 * own broadcasts merged into page one.
 */
export const useTransactionRecordsQuery = ({
    accountAddress,
    scope,
    assetId,
    afterTime,
    beforeTime,
    isEnabled = true,
}: UseTransactionRecordsQueryParams): UseTransactionRecordsQueryResult => {
    const fromMs = unixMsOf(afterTime)
    const beforeDayMs = unixMsOf(beforeTime)
    const untilMs =
        beforeDayMs === undefined
            ? undefined
            : beforeDayMs + SECONDS_PER_DAY * 1000

    // A record with no timestamp has no time to rule it out by, so the date range keeps it.
    const isKept = (record: TransactionRecord): boolean =>
        (assetId === undefined || involvesAsset(record, assetId)) &&
        (record.timestamp === undefined ||
            ((fromMs === undefined || record.timestamp >= fromMs) &&
                (untilMs === undefined || record.timestamp < untilMs)))

    const queryClient = useQueryClient()
    const queryKey = transactionQueryKeys.records(accountAddress, scope, {
        assetId,
        afterTime,
        beforeTime,
    })

    const query = useInfiniteQuery({
        queryKey,
        queryFn: async ({
            pageParam,
            signal,
        }: {
            pageParam: Nullable<PageRef>
            signal: AbortSignal
        }): Promise<RecordsPage> => {
            if (!onlineManager.isOnline()) {
                // A refetch rebuilds from page one and stops at the first page
                // with no cursor, so an offline page here would drop every page
                // already loaded. Throwing keeps them, and their cursors.
                if (
                    pageParam !== null ||
                    queryClient.getQueryData(queryKey) !== undefined
                ) {
                    throw new PeraNetworkError('offline')
                }
                // A cold start has nothing to lose: networkMode 'always' lets
                // it show the ledger's own sends, all there is offline.
                const pending = await getPendingTransactionRecords({
                    address: accountAddress,
                    scope,
                    listedIds: new Set(),
                })
                return { records: pending.filter(isKept), next: null }
            }

            // A backend page can be empty and still have a next one, and a
            // filtered page often is, so read on up to the cap.
            let page = pageParam ?? undefined
            for (let read = 1; ; read++) {
                signal.throwIfAborted()
                const { items, minedItems, next } =
                    await getTransactionHistoryWithPending(
                        accountAddress,
                        scope,
                        page,
                    )
                // Mined records only: a wallet send merged into page one can
                // predate the range while the next page still holds records in it.
                const isPastRange =
                    fromMs !== undefined &&
                    minedItems.some(
                        record =>
                            record.timestamp !== undefined &&
                            record.timestamp < fromMs,
                    )
                const records = items.filter(isKept)
                const nextPage = isPastRange ? undefined : next
                if (
                    records.length > 0 ||
                    !nextPage ||
                    read === MAX_RECORD_PAGE_READS
                ) {
                    return { records, next: nextPage ?? null }
                }
                page = nextPage
            }
        },
        initialPageParam: null as Nullable<PageRef>,
        getNextPageParam: (lastPage: RecordsPage) => lastPage.next ?? undefined,
        networkMode: 'always',
        enabled: isEnabled && !!accountAddress,
    })

    const records = useMemo(
        () => query.data?.pages.flatMap(page => page.records) ?? [],
        [query.data],
    )

    // An empty list never fires `onEndReached`, so a capped read that found
    // nothing would park the list on its skeleton. A failed page stops this
    // until a retry, and every MAX_AUTO_RECORD_FETCHES pages it pauses so a
    // barely used asset doesn't walk the whole history unasked.
    const {
        isFetched,
        isFetching,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = query
    const pageCount = query.data?.pages.length ?? 0
    const isNothingFound =
        isFetched && !isError && records.length === 0 && hasNextPage
    // Gated on the next page only, so a background refetch of the loaded pages
    // keeps the paused state up instead of flipping back to the skeleton.
    const isSearchPaused =
        isNothingFound &&
        !query.isFetchingNextPage &&
        pageCount % MAX_AUTO_RECORD_FETCHES === 0
    // Keyed on pageCount too: a fast page can land in the same notify batch as
    // its own fetching state, so `isFetching` never reads true in between.
    useEffect(() => {
        if (isNothingFound && !isFetching && !isSearchPaused)
            void fetchNextPage()
    }, [isNothingFound, isFetching, isSearchPaused, pageCount, fetchNextPage])

    const handleFetchNextPage = useCallback(
        () => void fetchNextPage(),
        [fetchNextPage],
    )
    const handleRefetch = useCallback(() => void refetch(), [refetch])

    return {
        records,
        isLoading: query.isLoading,
        isFetched,
        isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
        isError,
        error: query.error,
        hasNextPage,
        isSearchPaused,
        fetchNextPage: handleFetchNextPage,
        refetch: handleRefetch,
    }
}
