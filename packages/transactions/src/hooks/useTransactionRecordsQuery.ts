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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    useInfiniteQuery,
    useQueryClient,
    onlineManager,
    hashKey,
    type InfiniteData,
    type Query,
} from '@tanstack/react-query'
import type {
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import { useChainCapability } from '@perawallet/wallet-core-chain-shared'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import {
    readPositiveIntegerConfig,
    RemoteConfigKeys,
} from '@perawallet/wallet-core-remote-config'
import {
    isoDateToUnixSeconds,
    PeraNetworkError,
    toError,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    getMinedTransactionHistory,
    mergePendingRecords,
} from '../pending-history'
import { isRecordInAssetHistory } from '../utils/assetHistory'
import {
    historyTypeOf,
    type TransactionHistoryType,
} from '../utils/historyType'
import {
    historyReadRetryDelay,
    shouldRetryHistoryRead,
} from './historyReadRetry'
import {
    consumeFullRefetchRequest,
    requestFullRefetch,
    transactionQueryKeys,
} from './querykeys'
import { usePendingTransactionRecordsQuery } from './usePendingTransactionRecordsQuery'

export type UseTransactionRecordsQueryParams = {
    accountAddress: string
    scope: ChainScope
    /** Sent to the chain, which may ignore it, and kept client-side either way. */
    assetId?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive, UTC. */
    beforeTime?: string
    /**
     * Applied to the loaded pages, which every type shares, so switching types
     * reads nothing the list already holds. The backend reads the same pages
     * whatever the type.
     */
    historyType?: TransactionHistoryType
    /** Histories splitting one type filter's page budget, such as each network's on All. Defaults to 1. */
    typedScanShare?: number
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
    /** Stays true while a failed first page is re-read, unlike TanStack's. */
    isError: boolean
    /** The failure is a later page's: page one, and the wallet's sends merged into it, stand. */
    isNextPageError: boolean
    error: Nullable<Error>
    hasNextPage: boolean
    /**
     * The last {@link MAX_AUTO_RECORD_FETCHES} page fetches found nothing, or
     * with a type the scan read its {@link typedScanBudget}, with history
     * left: the hook stopped reading until `fetchNextPage` resumes it.
     * Holds with rows loaded too, so a list's load-more should respect it.
     */
    isSearchPaused: boolean
    fetchNextPage: () => void
    refetch: () => void
}

// The chain's records only: the wallet's own sends are merged in on read, from
// their own query, so a failed backend read never takes them away.
type RecordsPage = {
    records: TransactionRecord[]
    next: Nullable<PageRef>
    /** Page one only: the newest mined record the backend listed, where a later page-one refresh stops reading. */
    newestMinedId?: string
    /** Backend pages this fetch read, which a type filter's scan budget counts. */
    reads?: number
}

type RecordsRead = { page: RecordsPage; hasReachedLoadedPages: boolean }

// Pages a page-one refresh rebuilt, served to TanStack's re-read of the loaded
// pages without a network call. Keyed by the previous page's `next` object,
// which TanStack hands back as `pageParam`: a `getNextPageParam` that copies
// the cursor would turn every hit into a backend read.
const mergedPagesByCursor = new WeakMap<PageRef, RecordsPage>()

// TanStack resets a query with no data to `pending` and clears its error the
// moment it re-reads, so a failed page one would read as loading and then as
// empty. The error is kept here, per cache entry, until the re-read settles; a
// chip tap mounts a new hook on the same entry and must see it from render one.
const failedFirstPageErrors = new WeakMap<Query, Error>()

// A record that leaves page one without a replacement stays until a full
// re-read. `next` is never touched, so every cursor holds.
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

/** Bundled fallback for the `history_type_filter_scan_pages` remote value. */
export const DEFAULT_TYPED_SCAN_PAGES = 4

const MAX_TYPED_RECORD_PAGE_READS = 2

/** Backend pages a type filter reads in all, across every network, before it asks to go on. */
export const readTypedScanPages = (): number =>
    readPositiveIntegerConfig(
        RemoteConfigKeys.history_type_filter_scan_pages,
        DEFAULT_TYPED_SCAN_PAGES,
    )

/**
 * One history's share of `scanPages` when `share` histories scan at once: the
 * pages it reads before pausing, matched or not, so a type that matches once a
 * page still stops. Never below one page, so each network shows its newest.
 */
export const typedScanBudget = (
    share: number,
    scanPages: number,
): { pages: number; pageReads: number } => {
    const pages = Math.max(1, Math.floor(scanPages / share))
    return { pages, pageReads: Math.min(MAX_TYPED_RECORD_PAGE_READS, pages) }
}

// A scan begins where the list stood when its type was picked or Search Older
// was tapped, so only the pages read after that count toward its budget.
type TypedScan = { key: string; startPage: number }

const readsFrom = (pages: readonly RecordsPage[], startPage: number): number =>
    pages.slice(startPage).reduce((sum, page) => sum + (page.reads ?? 1), 0)

const unixMsOf = (isoDate?: string): Optional<number> => {
    const seconds = isoDateToUnixSeconds(isoDate)
    return Number.isFinite(seconds) ? seconds * 1000 : undefined
}

/**
 * History for a chain that keeps no cached rows (see `hasCachedHistoryRows`),
 * read page by page from the chain's `getTransactionHistory`, with the wallet's
 * own sends merged in from the submission ledger. Those show whatever the
 * backend does: a failed read leaves them listed beside the error.
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
    historyType,
    typedScanShare = 1,
    isEnabled = true,
}: UseTransactionRecordsQueryParams): UseTransactionRecordsQueryResult => {
    const fromMs = unixMsOf(afterTime)
    const beforeDayMs = unixMsOf(beforeTime)
    const untilMs =
        beforeDayMs === undefined
            ? undefined
            : beforeDayMs + SECONDS_PER_DAY * 1000

    // A record with no timestamp has no time to rule it out by, so the date range keeps it.
    const isInScope = useCallback(
        (record: TransactionRecord): boolean =>
            (assetId === undefined ||
                isRecordInAssetHistory(record, assetId, accountAddress)) &&
            (record.timestamp === undefined ||
                ((fromMs === undefined || record.timestamp >= fromMs) &&
                    (untilMs === undefined || record.timestamp < untilMs))),
        [assetId, accountAddress, fromMs, untilMs],
    )
    const isOfType = useCallback(
        (record: TransactionRecord): boolean =>
            historyType === undefined ||
            historyTypeOf(record.summary) === historyType,
        [historyType],
    )
    const isTyped = historyType !== undefined
    const [scanPages] = useState(readTypedScanPages)
    const typedBudget = typedScanBudget(typedScanShare, scanPages)
    const [scan, setScan] = useState<TypedScan>()
    // The page function runs outside render and reads where the scan began.
    const scanStartRef = useRef(0)

    const queryClient = useQueryClient()
    const isActive = isEnabled && !!accountAddress
    const contractDecoding = useChainCapability(
        scope.chainId,
        'contractDecoding',
    )
    const queryKey = transactionQueryKeys.records(accountAddress, scope, {
        assetId,
        afterTime,
        beforeTime,
        contractDecoding,
    })

    // Under a type, a later page reads no further than what is left of the scan.
    const nextPageReadCap = (): number => {
        if (!isTyped) return MAX_RECORD_PAGE_READS
        const loaded =
            queryClient.getQueryData<
                InfiniteData<RecordsPage, Nullable<PageRef>>
            >(queryKey)?.pages ?? []
        const read = readsFrom(loaded, scanStartRef.current)
        return Math.min(
            typedBudget.pageReads,
            Math.max(1, typedBudget.pages - read),
        )
    }

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
        const firstPageReadCap = isTyped
            ? typedBudget.pageReads
            : MAX_RECORD_PAGE_READS
        const readCap =
            pageParam === null ? firstPageReadCap : nextPageReadCap()
        let page = pageParam ?? undefined
        let newestMinedId: Optional<string>
        const records: TransactionRecord[] = []
        for (let read = 1; ; read++) {
            signal.throwIfAborted()
            let mined: Page<TransactionRecord>
            try {
                mined = await getMinedTransactionHistory(
                    accountAddress,
                    scope,
                    page,
                    { assetId, signal },
                )
            } catch (error) {
                // The pages read so far kept nothing, so an empty page resuming
                // at the failed cursor spares a retry re-reading them. A
                // refresh's pages replace page one, so it still throws.
                if (
                    read === 1 ||
                    signal.aborted ||
                    loadedNewestMinedId !== undefined
                ) {
                    throw error
                }
                return {
                    page: {
                        records,
                        next: page ?? null,
                        ...(newestMinedId !== undefined && { newestMinedId }),
                        reads: read - 1,
                    },
                    hasReachedLoadedPages: false,
                }
            }
            const { items: minedItems, next } = mined
            // The first read can be empty with a next page, so the newest id
            // is the first one any read lists.
            if (pageParam === null) newestMinedId ??= minedItems[0]?.id
            const loadedAt =
                loadedNewestMinedId === undefined
                    ? -1
                    : minedItems.findIndex(r => r.id === loadedNewestMinedId)
            const hasReachedLoadedPages = loadedAt !== -1
            // Records from the loaded newest on are already loaded.
            const loadedIds = new Set(
                hasReachedLoadedPages
                    ? minedItems.slice(loadedAt).map(r => r.id)
                    : [],
            )
            const isPastRange =
                fromMs !== undefined &&
                minedItems.some(
                    record =>
                        record.timestamp !== undefined &&
                        record.timestamp < fromMs,
                )
            records.push(
                ...minedItems
                    .filter(r => !loadedIds.has(r.id))
                    .filter(isInScope),
            )
            const nextPage = isPastRange ? undefined : next
            const isDone =
                loadedNewestMinedId === undefined
                    ? records.some(isOfType)
                    : hasReachedLoadedPages
            if (isDone || !nextPage || read >= readCap) {
                return {
                    page: {
                        records,
                        next: nextPage ?? null,
                        ...(newestMinedId !== undefined && { newestMinedId }),
                        reads: read,
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
                // A cold start has nothing to lose: an empty page reads as the
                // offline empty state, and the ledger's sends list beside it.
                const coldQuery = queryClient
                    .getQueryCache()
                    .get(hashKey(queryKey))
                if (coldQuery) failedFirstPageErrors.delete(coldQuery)
                return { records: [], next: null }
            }

            if (pageParam !== null) {
                return (await readPage(pageParam, signal)).page
            }

            const cachedQuery = queryClient
                .getQueryCache()
                .get(hashKey(queryKey))
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
            let read: RecordsRead
            try {
                read = await readPage(
                    null,
                    signal,
                    isFullRefetch ? undefined : loaded?.[0]?.newestMinedId,
                )
            } catch (error) {
                // The quiet retry re-runs this first read with the flag already
                // spent, so it would only refresh the head. A failed later page
                // is resumed by the retry itself, so it needs no such care.
                if (isFullRefetch) requestFullRefetch(cachedQuery)
                if (cachedQuery && !signal.aborted) {
                    failedFirstPageErrors.set(cachedQuery, toError(error))
                }
                throw error
            }
            // A cancelled read can still answer; the read that replaces it owns the error.
            if (cachedQuery && !signal.aborted) {
                failedFirstPageErrors.delete(cachedQuery)
            }
            const { page, hasReachedLoadedPages } = read
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
        retry: shouldRetryHistoryRead,
        retryDelay: historyReadRetryDelay,
        enabled: isActive,
    })

    const { records: pendingRecords, refetch: refetchPending } =
        usePendingTransactionRecordsQuery({
            accountAddress,
            scope,
            isEnabled: isActive,
        })
    const minedRecords = useMemo(
        () =>
            query.data?.pages.flatMap(page => page.records.filter(isOfType)) ??
            [],
        [query.data, isOfType],
    )
    const records = useMemo(
        () =>
            mergePendingRecords(
                pendingRecords.filter(isInScope).filter(isOfType),
                minedRecords,
            ),
        [pendingRecords, minedRecords, isInScope, isOfType],
    )

    // A page that found nothing changes no visible row, so `onEndReached`
    // can't be trusted to ask for the next one: the hook walks on itself while
    // the last page is empty. A failed page stops this until a retry, and every
    // MAX_AUTO_RECORD_FETCHES empty pages in a row it pauses, so a barely used
    // asset doesn't walk the whole history unasked. A type filter pauses once
    // its scan budget is read, matches or not: a type matching once a page
    // keeps a list short, and the list's end would page on past the rate limit.
    const {
        isFetched,
        isFetching,
        isError: isQueryError,
        hasNextPage,
        fetchNextPage,
        refetch,
    } = query
    const rereadQuery =
        isActive && query.isPending && isFetched
            ? queryClient.getQueryCache().get(hashKey(queryKey))
            : undefined
    const keptError = rereadQuery && failedFirstPageErrors.get(rereadQuery)
    const pages = query.data?.pages ?? []
    const pageCount = pages.length
    const trailingEmptyPages =
        pageCount - 1 - pages.findLastIndex(page => page.records.some(isOfType))
    const isWalking =
        isFetched && !isQueryError && hasNextPage && trailingEmptyPages > 0
    // Picking a type starts its scan where the list stands: the loaded pages
    // are filtered for free, and only reading further back costs calls.
    const scanKey = `${hashKey(queryKey)}|${historyType ?? ''}`
    const scanStart =
        scan?.key === scanKey ? Math.min(scan.startPage, pageCount) : pageCount
    if (scan?.key !== scanKey) setScan({ key: scanKey, startPage: scanStart })
    const scannedReads = readsFrom(pages, scanStart)
    // Gated on the next page only, so a background refetch of the loaded pages
    // keeps the paused state up instead of flipping back to the skeleton.
    const isSearchPaused = isTyped
        ? isFetched &&
          !isQueryError &&
          hasNextPage &&
          !query.isFetchingNextPage &&
          scannedReads >= typedBudget.pages
        : isWalking &&
          !query.isFetchingNextPage &&
          trailingEmptyPages % MAX_AUTO_RECORD_FETCHES === 0

    // Declared before the walk below, so a walk the new start allows reads it.
    useEffect(() => {
        scanStartRef.current = scanStart
    }, [scanStart])

    // Keyed on pageCount too: a fast page can land in the same notify batch as
    // its own fetching state, so `isFetching` never reads true in between.
    useEffect(() => {
        if (isWalking && !isFetching && !isSearchPaused) void fetchNextPage()
    }, [isWalking, isFetching, isSearchPaused, pageCount, fetchNextPage])

    // Only a fetch made while paused, such as Search Older, starts a new scan.
    const handleFetchNextPage = useCallback(() => {
        if (isTyped && isSearchPaused) {
            scanStartRef.current = pageCount
            setScan({ key: scanKey, startPage: pageCount })
        }
        void fetchNextPage()
    }, [isTyped, isSearchPaused, scanKey, pageCount, fetchNextPage])
    const handleRefetch = useCallback(() => {
        refetchPending()
        void refetch()
    }, [refetch, refetchPending])

    return {
        records,
        isLoading: query.isLoading && keptError === undefined,
        isFetched,
        isFetching,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: isQueryError || keptError !== undefined,
        isNextPageError: query.isFetchNextPageError,
        error: query.error ?? keptError ?? null,
        hasNextPage,
        isSearchPaused,
        fetchNextPage: handleFetchNextPage,
        refetch: handleRefetch,
    }
}
