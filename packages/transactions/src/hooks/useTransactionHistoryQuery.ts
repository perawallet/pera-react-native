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

import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery, onlineManager } from '@tanstack/react-query'
import type { Maybe, Network, Nullable } from '@perawallet/wallet-core-shared'
import { fetchTransactionHistory, fetchMoreTransactions } from '../api/history'
import { transactionQueryKeys } from './querykeys'
import type {
    TransactionHistoryItem,
    TransactionHistoryResult,
} from '../models/types'
import { getTransactionHistory } from '../db'
import { persistTransactionsToDb } from './useTransactionHistoryDb'

/**
 * SQLite pages are local and cheap, so they run deeper than the API's page —
 * the footer spinner should be a network event, not a scroll event.
 */
const DB_PAGE_SIZE = 100

/** Sentinel `nextUrl`s: the next page comes from SQLite / from the API. */
const DB_CURSOR = '__load_more_from_db__'
const API_CURSOR = '__load_more_from_api__'

type DbPageParam = {
    type: 'db'
    /** Inclusive round-time cursor; the next read starts here. */
    atOrBeforeRoundTime: number
    /**
     * TXIDs already held at exactly {@link atOrBeforeRoundTime}. The cursor is
     * inclusive so an atomic group sharing that round time isn't cut in half,
     * which means the rows we already have come back and must be dropped.
     */
    boundaryTxIds: string[]
}

type ApiPageParam = {
    type: 'api'
    url: string
    /** Strict round cutoff used to dedupe day-grain API overlap. */
    beforeRound?: number
    /** Round time of the oldest carried-over tx (seeds API `before_time`). */
    beforeRoundTime?: number
    /**
     * TXIDs already held from the boundary round. Atomic groups put multiple
     * txs in one round for the same account, so the cutoff must keep
     * same-round txs whose id we haven't seen yet rather than dropping the
     * whole round.
     */
    beforeRoundTxIds?: string[]
}

/** `null` = initial DB read; otherwise a DB cursor page or an API page. */
type PageParam = Nullable<DbPageParam | ApiPageParam>

/**
 * Oldest transaction across every loaded page. Pages arrive newest-first, so
 * this walks back from the end — and skips pages that dedupe emptied, which a
 * plain "last page's last row" lookup would trip over.
 */
const findOldestLoaded = (
    pages: TransactionHistoryResult[],
): Maybe<TransactionHistoryItem> => {
    for (let index = pages.length - 1; index >= 0; index--) {
        const { transactions } = pages[index]
        if (transactions.length > 0) {
            return transactions[transactions.length - 1]
        }
    }
    return undefined
}

/**
 * Parameters for the useTransactionHistoryQuery hook.
 */
export type UseTransactionHistoryQueryParams = {
    /** The Algorand account address to fetch transactions for */
    accountAddress: string
    /** The network to fetch transactions from */
    network: Network
    /** Optional: Filter transactions to only show those involving a specific asset */
    assetId?: string
    /** Optional: Only return transactions confirmed after this time (ISO 8601) */
    afterTime?: string
    /** Optional: Only return transactions confirmed before this time (ISO 8601) */
    beforeTime?: string
    /** Optional: Maximum number of transactions to return per request */
    limit?: number
    /** Optional: Whether the query is enabled */
    isEnabled?: boolean
}

/**
 * Return type for useTransactionHistoryQuery.
 * Abstracts away React Query internals to provide a clean, stable API.
 */
export type UseTransactionHistoryQueryResult = {
    /** All transactions fetched across all pages */
    transactions: TransactionHistoryItem[]
    /** Whether the initial data is being fetched */
    isLoading: boolean
    /**
     * Whether the query has resolved at least once. False while the query is
     * disabled (no account address yet), which `isLoading` cannot express —
     * a disabled query reports `isLoading: false` with no data, so consumers
     * that gate an empty state on `!isLoading` flash "no transactions" before
     * the first read (PERA-4861). Gate empty states on this instead.
     */
    isFetched: boolean
    /** Whether more data is being fetched */
    isFetchingNextPage: boolean
    /** Whether there was an error */
    isError: boolean
    /**
     * Whether the query is paused because the app is offline. Always `false`
     * here (the query runs offline via networkMode: 'always'); exposed so
     * consumers share the paused-aware render-state contract with pure-network
     * queries. See `getQueryRenderState` in `@perawallet/wallet-core-shared`.
     */
    isPaused: boolean
    /** The error if one occurred */
    error: Nullable<Error>
    /** Whether there are more pages to fetch */
    hasNextPage: boolean
    /** Function to fetch the next page */
    fetchNextPage: () => void
    /** Function to refetch the data */
    refetch: () => void
}

/**
 * Hook for fetching transaction history with DB-first reads and infinite scrolling.
 *
 * Pages walk the local database (populated by the sync service) on a round-time
 * cursor for as long as it has rows, then continue against the API, persisting
 * what they fetch. Only crossing that boundary costs a network round trip.
 */
export const useTransactionHistoryQuery = (
    params: UseTransactionHistoryQueryParams,
): UseTransactionHistoryQueryResult => {
    const {
        accountAddress,
        network,
        assetId,
        afterTime,
        beforeTime,
        limit,
        isEnabled = true,
    } = params

    const query = useInfiniteQuery({
        queryKey: transactionQueryKeys.historyWithFilters(
            accountAddress,
            network,
            {
                assetId,
                afterTime,
                beforeTime,
                limit,
            },
        ),
        queryFn: async ({
            pageParam,
        }: {
            pageParam: PageParam
        }): Promise<TransactionHistoryResult> => {
            // DB pages: the first read and every cursor page after it. Only
            // once SQLite runs dry does pagination cross to the network —
            // previously page 2 onwards always did, so scrolling back through
            // already-synced history refetched it over the wire.
            if (pageParam == null || pageParam.type === 'db') {
                const dbPageSize = limit ?? DB_PAGE_SIZE
                const rows = await getTransactionHistory({
                    accountAddress,
                    network,
                    assetId,
                    afterTime,
                    beforeTime,
                    limit: dbPageSize,
                    atOrBeforeRoundTime: pageParam?.atOrBeforeRoundTime,
                })

                const alreadyHeld = new Set(pageParam?.boundaryTxIds ?? [])
                const dbTransactions =
                    alreadyHeld.size > 0
                        ? rows.filter(tx => !alreadyHeld.has(tx.id))
                        : rows

                // Gauged on the raw row count, not the deduped one: a page
                // that filled up in SQLite has more behind it even when the
                // boundary filter emptied what we kept.
                const hasMoreInDb = rows.length >= dbPageSize

                return {
                    transactions: dbTransactions,
                    // Always continue. A short DB page means SQLite is
                    // exhausted, not that history ended — the API page decides
                    // that. Terminating here stranded partially-synced
                    // accounts on whatever few rows had landed.
                    pagination: {
                        hasNextPage: true,
                        hasPreviousPage: pageParam != null,
                        nextUrl: hasMoreInDb ? DB_CURSOR : API_CURSOR,
                        previousUrl: null,
                        totalFetched: dbTransactions.length,
                    },
                    currentRound: 0,
                }
            }

            // Past this point SQLite is exhausted and the page can only come
            // from the network. Because networkMode is
            // 'always' (so the first DB page loads offline), the queryFn also
            // runs for load-more while offline — guard it here so an offline
            // load-more resolves with a terminal page instead of throwing. That
            // keeps the DB-backed first page rendered and the query out of
            // `isError`; pagination resumes once connectivity returns.
            // Note: onlineManager.isOnline is a method, not a property.
            if (!onlineManager.isOnline()) {
                return {
                    transactions: [],
                    pagination: {
                        hasNextPage: false,
                        hasPreviousPage: true,
                        nextUrl: null,
                        previousUrl: null,
                        totalFetched: 0,
                    },
                    currentRound: 0,
                }
            }

            // Subsequent pages: fetch from API
            if (pageParam.url !== API_CURSOR) {
                const result = await fetchMoreTransactions({
                    url: pageParam.url,
                    network,
                    // Only meaningful on indexer-backed networks (see
                    // `isPeraBackedNetwork`), which have no replayable
                    // pagination URL and need the address alongside the
                    // cursor. Harmless to pass on Pera-backed networks.
                    accountAddress,
                    // Indexer-backed networks only: the indexer's
                    // next-token does not encode these filters the way the
                    // Pera path's absolute `url` does — omitting them here
                    // would silently widen a filtered list (one asset, or a
                    // date range) back to everything from page 2 onward.
                    // Harmless to pass on Pera-backed networks.
                    assetId,
                    afterTime,
                    beforeTime,
                    limit,
                })

                // Persist to DB in background
                if (result.transactions.length > 0) {
                    void persistTransactionsToDb(
                        result.transactions,
                        accountAddress,
                        network,
                    )
                }

                return result
            }

            // The Pera API only supports day-grain `before_time`, so the
            // boundary day overlaps with the DB page. We carry the oldest
            // DB tx's `confirmedRound` through pageParam and strip overlap
            // client-side using rounds (monotonic, unique per block).
            const beforeRound = pageParam.beforeRound
            const beforeTimeForApi =
                pageParam.beforeRoundTime !== undefined
                    ? new Date(pageParam.beforeRoundTime * 1000)
                          .toISOString()
                          .split('T')[0]
                    : beforeTime

            const result = await fetchTransactionHistory({
                accountAddress,
                network,
                assetId,
                afterTime,
                beforeTime: beforeTimeForApi,
                limit,
            })

            const beforeRoundTxIds = new Set(pageParam.beforeRoundTxIds ?? [])
            const dedupedTransactions =
                beforeRound !== undefined
                    ? result.transactions.filter(
                          tx =>
                              tx.confirmedRound < beforeRound ||
                              (tx.confirmedRound === beforeRound &&
                                  !beforeRoundTxIds.has(tx.id)),
                      )
                    : result.transactions

            // Persist to DB in background
            if (dedupedTransactions.length > 0) {
                void persistTransactionsToDb(
                    dedupedTransactions,
                    accountAddress,
                    network,
                )
            }

            return {
                ...result,
                transactions: dedupedTransactions,
            }
        },
        initialPageParam: null as PageParam,
        getNextPageParam: (
            lastPage: TransactionHistoryResult,
            allPages: TransactionHistoryResult[],
        ): Maybe<DbPageParam | ApiPageParam> => {
            const { nextUrl } = lastPage.pagination
            if (nextUrl === null) return undefined

            // Oldest across all pages, not just the last one: a page the
            // boundary filter emptied still has to hand a cursor forward.
            const oldest = findOldestLoaded(allPages)

            if (!oldest) {
                // Nothing cached at all — the initial sync hasn't written this
                // account's history yet. Fetch the API's newest page with no
                // cursor rather than declaring the account empty.
                return nextUrl === API_CURSOR
                    ? { type: 'api', url: API_CURSOR }
                    : undefined
            }

            if (nextUrl === DB_CURSOR) {
                const boundaryTxIds = allPages
                    .flatMap(page => page.transactions)
                    .filter(tx => tx.roundTime === oldest.roundTime)
                    .map(tx => tx.id)

                return {
                    type: 'db',
                    atOrBeforeRoundTime: oldest.roundTime,
                    // Accumulated across pages, not taken from the last one:
                    // a round time holding more rows than a page can carry
                    // would otherwise re-serve the earlier pages' rows and
                    // never advance.
                    boundaryTxIds,
                }
            }

            if (nextUrl === API_CURSOR) {
                return {
                    type: 'api',
                    url: API_CURSOR,
                    beforeRound: oldest.confirmedRound,
                    beforeRoundTime: oldest.roundTime,
                    beforeRoundTxIds: allPages
                        .flatMap(page => page.transactions)
                        .filter(
                            tx => tx.confirmedRound === oldest.confirmedRound,
                        )
                        .map(tx => tx.id),
                }
            }

            return { type: 'api', url: nextUrl }
        },
        staleTime: Infinity,
        // The first page is read from SQLite (the source of truth), so the
        // queryFn must run even while offline instead of pausing before the DB
        // read (TanStack's default networkMode: 'online'), which would strand
        // the history screen on skeletons. Later pages hit the network and are
        // guarded inside the queryFn (see the offline check above the API
        // branches) so an offline load-more resolves with a terminal page
        // rather than rejecting.
        networkMode: 'always',
        enabled: isEnabled && !!accountAddress,
    })

    // A fresh array identity here would break every downstream `useMemo` keyed
    // on `transactions` — notably the date grouping in `useAccountHistory` and
    // `useAssetTransactionList`, which would then re-sort and re-format every
    // loaded page on each render.
    const transactions = useMemo(
        () => query.data?.pages.flatMap(page => page.transactions) ?? [],
        [query.data],
    )

    // The first page reads SQLite, which is legitimately empty until the
    // initial sync writes this account's history — and an empty list never
    // fires `onEndReached`, so nothing would ask for the API page. Bridge that
    // one gap here; without it a fresh account sat on "no transactions" until
    // the user navigated away and back. Latched so a genuinely empty history
    // settles after a single API confirmation instead of retrying forever.
    const { isFetched, isFetching, hasNextPage, fetchNextPage } = query
    const hasBridgedEmptyCache = useRef(false)
    useEffect(() => {
        if (hasBridgedEmptyCache.current) return
        if (!isFetched || isFetching) return
        if (transactions.length > 0 || !hasNextPage) return

        hasBridgedEmptyCache.current = true
        void fetchNextPage()
    }, [isFetched, isFetching, hasNextPage, transactions.length, fetchNextPage])

    return {
        transactions,
        isLoading: query.isLoading,
        isFetched: query.isFetched,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        hasNextPage: query.hasNextPage ?? false,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
