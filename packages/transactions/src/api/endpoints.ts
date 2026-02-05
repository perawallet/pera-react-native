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

import { queryClient, Network } from '@perawallet/wallet-core-shared'
import {
    transactionHistoryResponseSchema,
    type TransactionHistoryApiResponse,
} from './schema'
import { transformTransactionHistoryResponse } from './transformers'
import { DEFAULT_ITEMS_PER_PAGE } from '../models/constants'
import type { TransactionHistoryResult } from '../models/types'

/**
 * Parameters for fetching transaction history.
 */
export type FetchTransactionHistoryParams = {
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
    /** Optional: AbortSignal for cancellation */
    signal?: AbortSignal
}

/**
 * Parameters for fetching more transactions using a pagination URL.
 */
export type FetchMoreTransactionsParams = {
    /** The full URL to fetch (from previous response's nextUrl or previousUrl) */
    url: string
    /** The network to fetch transactions from */
    network: Network
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
 * Fetches transaction history for a given account.
 *
 * This is the main entry point for fetching transactions. It handles the initial
 * request to get the first page of results with optional filtering.
 */
export const fetchTransactionHistory = async (
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
 * Fetches more transactions using a pagination URL.
 *
 * Use this function when you have a nextUrl or previousUrl from a previous
 * response and want to fetch that specific page.
 */
export const fetchMoreTransactions = async (
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
