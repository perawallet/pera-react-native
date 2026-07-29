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

/** `null` = initial DB read; otherwise an API page. */
type PageParam = Nullable<ApiPageParam>

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
 * The first page is read from the local database (populated by the sync service).
 * Subsequent pages (load-more) are fetched from the API and persisted to DB.
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
            // First page: read from DB
            if (pageParam == null) {
                const dbTransactions = await getTransactionHistory({
                    accountAddress,
                    network,
                    assetId,
                    afterTime,
                    beforeTime,
                    limit: limit ?? 25,
                })

                return {
                    transactions: dbTransactions,
                    pagination: {
                        hasNextPage: dbTransactions.length >= (limit ?? 25),
                        hasPreviousPage: false,
                        nextUrl:
                            dbTransactions.length >= (limit ?? 25)
                                ? '__load_more_from_api__'
                                : null,
                        previousUrl: null,
                        totalFetched: dbTransactions.length,
                    },
                    currentRound: 0,
                }
            }

            // Subsequent pages live only on the network. Because networkMode is
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
            if (pageParam.url !== '__load_more_from_api__') {
                const result = await fetchMoreTransactions({
                    url: pageParam.url,
                    network,
                    // Only meaningful on indexer-backed networks (see
                    // `hasPeraServiceFallback`), which have no replayable
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
        ): Maybe<ApiPageParam> => {
            if (lastPage.pagination.nextUrl === null) return undefined

            if (lastPage.pagination.nextUrl === '__load_more_from_api__') {
                const oldest =
                    lastPage.transactions[lastPage.transactions.length - 1]
                const beforeRoundTxIds =
                    oldest !== undefined
                        ? lastPage.transactions
                              .filter(
                                  tx =>
                                      tx.confirmedRound ===
                                      oldest.confirmedRound,
                              )
                              .map(tx => tx.id)
                        : undefined
                return {
                    type: 'api',
                    url: '__load_more_from_api__',
                    beforeRound: oldest?.confirmedRound,
                    beforeRoundTime: oldest?.roundTime,
                    beforeRoundTxIds,
                }
            }

            return { type: 'api', url: lastPage.pagination.nextUrl }
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

    const transactions =
        query.data?.pages.flatMap(page => page.transactions) ?? []

    return {
        transactions,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        isPaused: query.isPaused,
        error: query.error,
        hasNextPage: query.hasNextPage ?? false,
        fetchNextPage: () => void query.fetchNextPage(),
        refetch: () => void query.refetch(),
    }
}
