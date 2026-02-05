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
import type { Network } from '@perawallet/wallet-core-shared'
import {
    fetchTransactionHistory,
    fetchMoreTransactions,
} from '../api/endpoints'
import { transactionQueryKeys } from './querykeys'
import type {
    TransactionHistoryItem,
    TransactionHistoryResult,
} from '../models/types'

/**
 * Parameters for the useTransactionHistoryQuery hook.
 */
export type UseTransactionHistoryQueryParams = {
    /** The Algorand account address to fetch transactions for */
    accountAddress: string
    /** The network to fetch transactions from */
    network: Network
    /** Optional: Filter transactions to only show those involving a specific asset */
    assetId?: number
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
    /** The error if one occurred */
    error: Error | null
    /** Whether there are more pages to fetch */
    hasNextPage: boolean
    /** Function to fetch the next page */
    fetchNextPage: () => void
    /** Function to refetch the data */
    refetch: () => void
}

/**
 * Hook for fetching transaction history with infinite scrolling support.
 *
 * This hook uses React Query's useInfiniteQuery to provide automatic
 * pagination handling. Transactions are accumulated across pages.
 *
 * @example
 * ```typescript
 * const {
 *   transactions,
 *   isLoading,
 *   hasNextPage,
 *   fetchNextPage,
 * } = useTransactionHistoryQuery({
 *   accountAddress: 'ABC123...',
 *   network: 'mainnet',
 *   limit: 25,
 * })
 * ```
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
        queryKey: transactionQueryKeys.historyWithFilters(accountAddress, {
            assetId,
            afterTime,
            beforeTime,
            limit,
        }),
        queryFn: async ({
            pageParam,
            signal,
        }: {
            pageParam: string | null
            signal: AbortSignal
        }): Promise<TransactionHistoryResult> => {
            if (pageParam) {
                // Fetch using pagination URL
                return fetchMoreTransactions({
                    url: pageParam,
                    network,
                    signal,
                })
            }

            // Initial fetch
            return fetchTransactionHistory({
                accountAddress,
                network,
                assetId,
                afterTime,
                beforeTime,
                limit,
                signal,
            })
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: TransactionHistoryResult): string | null =>
            lastPage.pagination.nextUrl,
        enabled: isEnabled && !!accountAddress,
    })

    // Flatten all pages into a single array of transactions
    const transactions =
        query.data?.pages.flatMap(page => page.transactions) ?? []

    return {
        transactions,
        isLoading: query.isLoading,
        isFetchingNextPage: query.isFetchingNextPage,
        isError: query.isError,
        error: query.error,
        hasNextPage: query.hasNextPage ?? false,
        fetchNextPage: query.fetchNextPage,
        refetch: query.refetch,
    }
}
