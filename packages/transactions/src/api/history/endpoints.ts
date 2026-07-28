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

import { queryClient, type Network } from '@perawallet/wallet-core-shared'
import { hasPeraServiceFallback } from '@perawallet/wallet-core-config'
import {
    transactionHistoryResponseSchema,
    type TransactionHistoryApiResponse,
} from './schema'
import { transformTransactionHistoryResponse } from './transformers'
import {
    fetchIndexerTransactionHistory,
    fetchMoreIndexerTransactions,
} from './indexer/endpoints'
import { DEFAULT_ITEMS_PER_PAGE } from '../../models/constants'
import type { TransactionHistoryResult } from '../../models/types'

/**
 * Parameters for fetching transaction history.
 */
export type FetchTransactionHistoryParams = {
    /** The Algorand account address to fetch transactions for */
    accountAddress: string
    /** The network to fetch transactions from */
    network: Network
    /** Optional: Filter transactions to only show those involving a specific asset */
    assetId?: string
    /** Optional: Only return transactions confirmed after this date (YYYY-MM-DD) */
    afterTime?: string
    /** Optional: Only return transactions confirmed before this date (YYYY-MM-DD) */
    beforeTime?: string
    /** Optional: Maximum number of transactions to return per request */
    limit?: number
    /** Optional: AbortSignal for cancellation */
    signal?: AbortSignal
}

/**
 * Parameters for fetching more transactions using a pagination URL.
 */
export type FetchMoreTransactionsParams = {
    /**
     * The full URL to fetch (from previous response's nextUrl or previousUrl)
     * on Pera-backed networks. On indexer-backed networks (see
     * `hasPeraServiceFallback`) this instead carries the indexer's opaque
     * `next-token`, since the indexer has no absolute next-page URL to replay.
     */
    url: string
    /** The network to fetch transactions from */
    network: Network
    /**
     * Required only on indexer-backed networks: the indexer paginates by
     * account, and its opaque next-token has no address encoded in it the way
     * a Pera pagination URL does.
     */
    accountAddress?: string
    /** Optional: AbortSignal for cancellation */
    signal?: AbortSignal
}

/**
 * Builds query parameters object for the API request.
 */
const buildQueryParams = (
    params: Omit<
        FetchTransactionHistoryParams,
        'accountAddress' | 'network' | 'signal'
    >,
): Record<string, string | number> => {
    const queryParams: Record<string, string | number> = {
        limit: params.limit ?? DEFAULT_ITEMS_PER_PAGE,
    }

    if (params.assetId !== undefined) {
        // Pass the id through as a string: parseInt would silently round an
        // id above 2^53 and filter by the wrong asset.
        queryParams.asset_id = params.assetId
    }

    if (params.afterTime !== undefined) {
        queryParams.after_time = params.afterTime
    }

    if (params.beforeTime !== undefined) {
        queryParams.before_time = params.beforeTime
    }

    return queryParams
}

/**
 * Fetches transaction history for a given account from the Pera backend.
 *
 * This handles the initial request to get the first page of results with
 * optional filtering. Used directly on networks with a real Pera backend;
 * routed to via `fetchTransactionHistory` below on the rest.
 */
const fetchPeraTransactionHistory = async (
    params: FetchTransactionHistoryParams,
): Promise<TransactionHistoryResult> => {
    const { accountAddress, network, signal, ...queryParams } = params

    const response = await queryClient<TransactionHistoryApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: `/v1/accounts/${encodeURIComponent(accountAddress)}/transactions/`,
        params: buildQueryParams(queryParams),
        signal,
    })

    const validated = transactionHistoryResponseSchema.parse(response.data)
    return transformTransactionHistoryResponse(validated)
}

/**
 * Fetches more transactions from the Pera backend using a pagination URL.
 *
 * Use this function when you have a nextUrl or previousUrl from a previous
 * response and want to fetch that specific page. Routed to via
 * `fetchMoreTransactions` below on networks with a real Pera backend.
 */
const fetchMorePeraTransactions = async (
    params: FetchMoreTransactionsParams,
): Promise<TransactionHistoryResult> => {
    const { url, network, signal } = params

    // Extract the path from the full URL (the queryClient will add the base URL)
    const urlObj = new URL(url)
    const pathWithSearch = urlObj.pathname + urlObj.search

    const response = await queryClient<TransactionHistoryApiResponse>({
        backend: 'pera',
        network,
        method: 'GET',
        url: pathWithSearch,
        signal,
    })

    const validated = transactionHistoryResponseSchema.parse(response.data)
    return transformTransactionHistoryResponse(validated)
}

/**
 * Transaction history for an account. Networks whose Pera services are
 * borrowed (see `hasPeraServiceFallback`) read from their own chain's indexer
 * instead: borrowed history is another chain's data, so a transaction just
 * sent would never show up.
 *
 * This is the main entry point for fetching transactions.
 */
export const fetchTransactionHistory = async (
    params: FetchTransactionHistoryParams,
): Promise<TransactionHistoryResult> =>
    hasPeraServiceFallback(params.network)
        ? fetchIndexerTransactionHistory(params)
        : fetchPeraTransactionHistory(params)

/**
 * Fetches more transactions using a pagination cursor from a previous
 * response.
 *
 * Use this function when you have a nextUrl (Pera-backed networks) or a
 * next-token (indexer-backed networks) from a previous response and want to
 * fetch that specific page.
 */
export const fetchMoreTransactions = async (
    params: FetchMoreTransactionsParams,
): Promise<TransactionHistoryResult> => {
    if (!hasPeraServiceFallback(params.network)) {
        return fetchMorePeraTransactions(params)
    }

    // On indexer-backed networks `url` carries the indexer's opaque
    // next-token (see `transformIndexerTransactions`), not an absolute Pera
    // URL, and the indexer has no address encoded in that token.
    if (params.accountAddress === undefined) {
        throw new Error(
            'fetchMoreTransactions requires accountAddress on indexer-backed networks',
        )
    }

    return fetchMoreIndexerTransactions({
        accountAddress: params.accountAddress,
        nextToken: params.url,
        network: params.network,
        signal: params.signal,
    })
}
