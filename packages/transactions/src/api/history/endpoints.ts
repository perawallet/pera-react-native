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
import { isPeraBackedNetwork } from '@perawallet/wallet-core-config'
import {
    parseTransactionHistoryResponse,
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
     * A full URL on Pera-backed networks; the indexer's opaque `next-token`
     * elsewhere, since the indexer has no absolute next-page URL to replay.
     */
    url: string
    /** The network to fetch transactions from */
    network: Network
    /**
     * Indexer-backed networks only: it paginates by account, and its next-token
     * encodes no address the way a Pera pagination URL does.
     */
    accountAddress?: string
    /**
     * The indexer's `next-token` doesn't encode the first page's filters, so
     * they must be re-sent every page. Ignored on the Pera path, which replays
     * `url` as-is.
     */
    assetId?: string
    /** Indexer-backed networks only: see `assetId`. */
    afterTime?: string
    /** Indexer-backed networks only: see `assetId`. */
    beforeTime?: string
    /** Indexer-backed networks only: see `assetId`. */
    limit?: number
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

/** First page from the Pera backend. Routed to by `fetchTransactionHistory`. */
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

    const validated = parseTransactionHistoryResponse(response.data)
    return transformTransactionHistoryResponse(validated, accountAddress)
}

/** A specific page by URL. Routed to by `fetchMoreTransactions`. */
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

    const validated = parseTransactionHistoryResponse(response.data)
    // The page URL is `/v1/accounts/{address}/transactions/…` — recover the
    // address for close-amount derivation when the caller didn't pass one.
    const addressFromUrl = decodeURIComponent(
        urlObj.pathname.match(/\/accounts\/([^/]+)\//)?.[1] ?? '',
    )
    const accountAddress =
        params.accountAddress ?? (addressFromUrl || undefined)
    return transformTransactionHistoryResponse(validated, accountAddress)
}

/**
 * Networks with no Pera backend read their own chain's indexer — another
 * chain's history would never show a transaction just sent.
 */
export const fetchTransactionHistory = async (
    params: FetchTransactionHistoryParams,
): Promise<TransactionHistoryResult> =>
    isPeraBackedNetwork(params.network)
        ? fetchPeraTransactionHistory(params)
        : fetchIndexerTransactionHistory(params)

/** Takes a nextUrl on Pera-backed networks, a next-token on indexer-backed ones. */
export const fetchMoreTransactions = async (
    params: FetchMoreTransactionsParams,
): Promise<TransactionHistoryResult> => {
    if (isPeraBackedNetwork(params.network)) {
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
        assetId: params.assetId,
        afterTime: params.afterTime,
        beforeTime: params.beforeTime,
        limit: params.limit,
        signal: params.signal,
    })
}
