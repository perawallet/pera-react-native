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

import {
    createChainAdapterRegistry,
    scopeForLegacyNetwork,
    type ChainId,
    type ChainScope,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-chain-contract'

import type { Network, Nullable } from '@perawallet/wallet-core-shared'
import type {
    TransactionHistoryItem,
    TransactionHistoryResult,
} from './models/types'

/**
 * Parameters for fetching transaction history.
 */
export type FetchTransactionHistoryParams = {
    /** The account address to fetch transactions for */
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

/** Unit name and decimals as an amount renderer needs them. */
export type AssetDisplayFacts = {
    unitName: string
    decimals: number
}

/**
 * Persisted rows can hold an id as a number (written before ids became
 * strings) and indexer rows as a bigint, so a resolver takes every shape.
 */
export type AssetFactsResolver = (
    assetId: string | number | bigint | null | undefined,
    facts: AssetDisplayFacts,
) => AssetDisplayFacts

/** The chain-specific history source; registered by the chain package. */
export interface HistoryChainAdapter {
    chainId: ChainId
    fetchHistory(
        params: Omit<FetchTransactionHistoryParams, 'network'> & {
            scope: ChainScope
        },
    ): Promise<TransactionHistoryResult>
    fetchMoreHistory(
        params: Omit<FetchMoreTransactionsParams, 'network'> & {
            scope: ChainScope
        },
    ): Promise<TransactionHistoryResult>
    /** Swept close amount in base units, as a decimal string; null when the transaction has no close leg. */
    fetchCloseAmount?(
        txId: string,
        scope: ChainScope,
    ): Promise<Nullable<string>>
    toDisplayable(
        item: TransactionHistoryItem,
    ): Nullable<PeraDisplayableTransaction>
    /**
     * Replaces facts the chain's backend is known to get wrong, applied when a
     * cached row is read back: the syncer never refetches an old row.
     */
    resolveAssetFacts?: AssetFactsResolver
}

export const historyChainAdapters =
    createChainAdapterRegistry<HistoryChainAdapter>('transaction history')

const keepFacts: AssetFactsResolver = (_assetId, facts) => facts

// Not `get`: a chain with no history adapter never wrote a row to repair.
export const assetFactsResolverFor = (chainId: ChainId): AssetFactsResolver =>
    (historyChainAdapters.has(chainId)
        ? historyChainAdapters.get(chainId).resolveAssetFacts
        : undefined) ?? keepFacts

const adapterFor = (
    network: Network,
): { adapter: HistoryChainAdapter; scope: ChainScope } => {
    const scope = scopeForLegacyNetwork(network)
    return { adapter: historyChainAdapters.get(scope.chainId), scope }
}

export const fetchTransactionHistory = async ({
    network,
    ...params
}: FetchTransactionHistoryParams): Promise<TransactionHistoryResult> => {
    const { adapter, scope } = adapterFor(network)
    return adapter.fetchHistory({ ...params, scope })
}

/** Takes a nextUrl on Pera-backed networks, a next-token on indexer-backed ones. */
export const fetchMoreTransactions = async ({
    network,
    ...params
}: FetchMoreTransactionsParams): Promise<TransactionHistoryResult> => {
    const { adapter, scope } = adapterFor(network)
    return adapter.fetchMoreHistory({ ...params, scope })
}

/** Null when the chain has no lookup. */
export const fetchCloseAmount = async (
    txId: string,
    network: Network,
): Promise<Nullable<string>> => {
    const { adapter, scope } = adapterFor(network)
    return adapter.fetchCloseAmount?.(txId, scope) ?? null
}

export const mapHistoryItemToDisplayableTransaction = (
    item: TransactionHistoryItem,
    network: Network,
): Nullable<PeraDisplayableTransaction> =>
    adapterFor(network).adapter.toDisplayable(item)
