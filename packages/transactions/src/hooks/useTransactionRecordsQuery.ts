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
    type InfiniteData,
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
import {
    consumeFullRefetchRequest,
    requestFullRefetch,
    transactionQueryKeys,
} from './querykeys'

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
     * The last {@link MAX_AUTO_RECORD_FETCHES} page fetches found nothing, with
     * history left: the hook stopped reading until `fetchNextPage` resumes it.
     * Holds with rows loaded too, so a list's load-more should respect it.
     */
    isSearchPaused: boolean
    fetchNextPage: () => void
    refetch: () => void
}

type RecordsPage = {
    records: TransactionRecord[]
    next: Nullable<PageRef>
    /** Page one only: the newest mined record the backend listed, where a later page-one refresh stops reading. */
    newestMinedId?: string
}

type RecordsRead = { page: RecordsPage; hasReachedLoadedPages: boolean }

// Pages a page-one refresh rebuilt, served to TanStack's re-read of the loaded
// pages without a network call. Keyed by the previous page's `next` object,
// which TanStack hands back as `pageParam`: a `getNextPageParam` that copies
// the cursor would turn every hit into a backend read.
const mergedPagesByCursor = new WeakMap<PageRef, RecordsPage>()

// A record that leaves page one without a replacement (a pruned failed send)
// stays until a full re-read. `next` is never touched, so every cursor holds.
const mergeRefreshedFirstPage = (
    loaded: RecordsPage[],
    refreshed: RecordsPage,
): RecordsPage[] => {
    const loadedIds = new Set(
        loaded.flatMap(page => page.records.map(r => r.id)),
    )
    const refreshedById = new Map(refreshed.records.map(r => [r.id, r]))
    const added = refreshed.records.filter(r => !loadedIds.has(r.id))
    return loaded.map((page, index) => ({
        ...page,
        records: [
            ...(index === 0 ? added : []),
            ...page.records.map(r => refreshedById.get(r.id) ?? r),
        ],
        ...(index === 0 && { newestMinedId: refreshed.newestMinedId }),
    }))
}

/**
 * Backend pages one page fetch reads looking for a record the filters keep.
 * Bounded so a long filtered stretch loads in steps: a failure keeps what was
 * read, and an unmount stops it.
 */
export const MAX_RECORD_PAGE_READS = 5

/** Empty page fetches in a row the hook makes on its own, per resume. */
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
 *
 * A refetch re-reads from the head only as far as the newest record page one
 * last listed and merges by id, keeping the loaded pages and their cursors; it
 * re-reads every page only when asked to (see `shouldRefetchAllPages`) or when
 * the head no longer reaches them.
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

    // A backend page can be empty and still have a next one, and a filtered
    // page often is, so a first-page read goes on up to the cap. With
    // `loadedNewestMinedId` it is a refresh instead: it goes on until the read
    // that lists that record, so a page of new activity costs one backend read
    // however sparse the filter.
    const readPage = async (
        pageParam: Nullable<PageRef>,
        signal: AbortSignal,
        loadedNewestMinedId?: string,
    ): Promise<RecordsRead> => {
        let page = pageParam ?? undefined
        let newestMinedId: Optional<string>
        const records: TransactionRecord[] = []
        for (let read = 1; ; read++) {
            signal.throwIfAborted()
            const { items, minedItems, next } =
                await getTransactionHistoryWithPending(
                    accountAddress,
                    scope,
                    page,
                )
            // The first read can be empty with a next page, so the newest id
            // is the first one any read lists.
            if (pageParam === null) newestMinedId ??= minedItems[0]?.id
            const loadedAt =
                loadedNewestMinedId === undefined
                    ? -1
                    : minedItems.findIndex(r => r.id === loadedNewestMinedId)
            const hasReachedLoadedPages = loadedAt !== -1
            // Mined records from the loaded newest on are already loaded. The
            // wallet's own sends stay: their status may have changed.
            const loadedIds = new Set(
                hasReachedLoadedPages
                    ? minedItems.slice(loadedAt).map(r => r.id)
                    : [],
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
            records.push(
                ...items.filter(r => !loadedIds.has(r.id)).filter(isKept),
            )
            const nextPage = isPastRange ? undefined : next
            const isDone =
                loadedNewestMinedId === undefined
                    ? records.length > 0
                    : hasReachedLoadedPages
            if (isDone || !nextPage || read === MAX_RECORD_PAGE_READS) {
                return {
                    page: {
                        records,
                        next: nextPage ?? null,
                        ...(newestMinedId !== undefined && { newestMinedId }),
                    },
                    hasReachedLoadedPages,
                }
            }
            page = nextPage
        }
    }

    const query = useInfiniteQuery({
        queryKey,
        queryFn: async ({
            pageParam,
            signal,
        }: {
            pageParam: Nullable<PageRef>
            signal: AbortSignal
        }): Promise<RecordsPage> => {
            const merged = pageParam && mergedPagesByCursor.get(pageParam)
            if (merged) {
                mergedPagesByCursor.delete(pageParam)
                return merged
            }

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

            if (pageParam !== null) {
                return (await readPage(pageParam, signal)).page
            }

            const cachedQuery = queryClient
                .getQueryCache()
                .find({ queryKey, exact: true })
            const isFullRefetch =
                cachedQuery !== undefined &&
                consumeFullRefetchRequest(cachedQuery)
            if (isFullRefetch) {
                // An invalidation landing mid re-read cancels it; the refetch
                // that replaces it must still be a full one.
                signal.addEventListener(
                    'abort',
                    () => requestFullRefetch(cachedQuery),
                    { once: true },
                )
            }
            const loaded =
                queryClient.getQueryData<
                    InfiniteData<RecordsPage, Nullable<PageRef>>
                >(queryKey)?.pages
            // A refresh that was cancelled before its re-read left entries behind.
            for (const { next } of loaded ?? []) {
                if (next) mergedPagesByCursor.delete(next)
            }
            const { page, hasReachedLoadedPages } = await readPage(
                null,
                signal,
                isFullRefetch ? undefined : loaded?.[0]?.newestMinedId,
            )
            if (!loaded || !hasReachedLoadedPages) return page

            const pages = mergeRefreshedFirstPage(loaded, page)
            pages.forEach(({ next }, index) => {
                if (next && pages[index + 1]) {
                    mergedPagesByCursor.set(next, pages[index + 1])
                }
            })
            return pages[0]
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

    // A page that found nothing changes no visible row, so `onEndReached`
    // can't be trusted to ask for the next one: the hook walks on itself while
    // the last page is empty. A failed page stops this until a retry, and every
    // MAX_AUTO_RECORD_FETCHES empty pages in a row it pauses, so a barely used
    // asset doesn't walk the whole history unasked.
    const {
        isFetched,
        isFetching,
        isError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = query
    const pages = query.data?.pages ?? []
    const pageCount = pages.length
    const trailingEmptyPages =
        pageCount - 1 - pages.findLastIndex(page => page.records.length > 0)
    const isWalking =
        isFetched && !isError && hasNextPage && trailingEmptyPages > 0
    // Gated on the next page only, so a background refetch of the loaded pages
    // keeps the paused state up instead of flipping back to the skeleton.
    const isSearchPaused =
        isWalking &&
        !query.isFetchingNextPage &&
        trailingEmptyPages % MAX_AUTO_RECORD_FETCHES === 0
    // Keyed on pageCount too: a fast page can land in the same notify batch as
    // its own fetching state, so `isFetching` never reads true in between.
    useEffect(() => {
        if (isWalking && !isFetching && !isSearchPaused) void fetchNextPage()
    }, [isWalking, isFetching, isSearchPaused, pageCount, fetchNextPage])

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
