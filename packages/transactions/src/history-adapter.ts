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
    type ChainCapabilities,
    type ChainId,
    type ChainScope,
    type Page,
    type PageRef,
    type TransactionNative,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'

import {
    AppError,
    ErrorCategory,
    logger,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { TransactionDetailNotFoundError } from './errors'
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
    scope: ChainScope
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
    scope: ChainScope
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

export class TransactionHistoryRowsUnsupportedError extends AppError {
    readonly chainId: ChainId

    constructor(chainId: ChainId) {
        super(`Cached history rows are not supported on ${chainId}.`, {
            category: ErrorCategory.TRANSACTIONS,
            recoverable: false,
        })
        this.name = 'TransactionHistoryRowsUnsupportedError'
        this.chainId = chainId
    }
}

/** The item fields a chain keeps in `transactions.chain_data`. */
export type TransactionHistoryChainFields = Pick<
    TransactionHistoryItem,
    'confirmedRound' | 'roundTime' | 'chainData'
>

/**
 * How a chain stores its own facts in `transactions.chain_data`. Paths are
 * SQLite JSON paths into the document `encode` writes.
 */
export interface HistoryChainDataCodec {
    encode(fields: TransactionHistoryChainFields): string
    /** Also reads every older document shape the chain's migrations left behind. */
    decode(json: string): TransactionHistoryChainFields
    /** Asset ids a row involves beyond its top-level asset and balance impacts, for the per-asset history filter. */
    assetIdPaths: readonly string[]
    /**
     * Scalar facts only some accounts' perspectives can derive. The row is
     * shared across accounts, so an upsert that lacks one keeps the stored value.
     */
    stickyPaths: readonly string[]
}

/** What the app knows that a chain package can't read for itself. */
export type HistoryReadOptions = {
    /** The scope's capabilities now; a chain reads the ones that change how it words a row. */
    capabilities: ChainCapabilities
}

/** The chain-specific history source; registered by the chain package. */
export interface HistoryChainAdapter {
    chainId: ChainId
    /** Absent on a chain whose history isn't cached as `TransactionHistoryItem` rows. */
    fetchHistory?(
        params: FetchTransactionHistoryParams,
    ): Promise<TransactionHistoryResult>
    /** Absent on a chain whose history isn't cached as `TransactionHistoryItem` rows. */
    fetchMoreHistory?(
        params: FetchMoreTransactionsParams,
    ): Promise<TransactionHistoryResult>
    /** Newest first, every summary read from `address`'s side. Throws on another chain's scope. */
    getTransactionHistory(
        address: string,
        scope: ChainScope,
        page?: PageRef,
        options?: HistoryReadOptions,
    ): Promise<Page<TransactionRecord>>
    /**
     * The transaction as the chain holds it, for a detail screen that needs
     * more than the history row gives. Null when the chain no longer holds it.
     */
    getTransactionDetail?(
        txId: string,
        scope: ChainScope,
        record: TransactionRecord,
    ): Promise<Nullable<TransactionNative>>
    /**
     * The list row for a stored item, read from `address`'s side. Absent on a
     * chain whose history isn't cached as `TransactionHistoryItem` rows.
     */
    summarize?(
        item: TransactionHistoryItem,
        address: string,
    ): TransactionSummary
    /**
     * The id of the group whose transaction list a press on this row opens,
     * or null when the press opens the row's own detail.
     */
    groupToOpen?(item: TransactionHistoryItem): Nullable<string>
    /** Absent on a chain whose history isn't cached as `TransactionHistoryItem` rows. */
    toTransactionNative?(
        item: TransactionHistoryItem,
    ): Nullable<TransactionNative>
    /**
     * Replaces facts the chain's backend is known to get wrong, applied when a
     * cached row is read back: the syncer never refetches an old row.
     */
    resolveAssetFacts?: AssetFactsResolver
    /** Absent on a chain whose history isn't cached as `TransactionHistoryItem` rows. */
    chainData?: HistoryChainDataCodec
    /**
     * Repairs the account's cached rows after each sync, for facts the
     * backend left out that no later fetch revisits.
     */
    healCachedRows?(params: {
        scope: ChainScope
        accountAddress: string
    }): Promise<void>
}

export const historyChainAdapters =
    createChainAdapterRegistry<HistoryChainAdapter>('transaction history')

const keepFacts: AssetFactsResolver = (_assetId, facts) => facts

// Not `get`: a chain with no history adapter never wrote a row to repair.
export const assetFactsResolverFor = (chainId: ChainId): AssetFactsResolver =>
    (historyChainAdapters.has(chainId)
        ? historyChainAdapters.get(chainId).resolveAssetFacts
        : undefined) ?? keepFacts

/**
 * False on a chain that reads its history as records through
 * `getTransactionHistory` instead of caching rows, where every row-path
 * call would reject with {@link TransactionHistoryRowsUnsupportedError}.
 */
export const hasCachedHistoryRows = (chainId: ChainId): boolean =>
    historyChainAdapters.has(chainId) &&
    historyChainAdapters.get(chainId).fetchHistory !== undefined

/** Rejects with {@link TransactionDetailNotFoundError} on a chain that declares no `getTransactionDetail`. */
export const fetchTransactionDetail = async (
    txId: string,
    scope: ChainScope,
    record: TransactionRecord,
): Promise<Nullable<TransactionNative>> => {
    const adapter = historyChainAdapters.get(scope.chainId)
    if (!adapter.getTransactionDetail) {
        throw new TransactionDetailNotFoundError(txId)
    }
    return adapter.getTransactionDetail(txId, scope, record)
}

/** Rejects with {@link TransactionHistoryRowsUnsupportedError} on a chain that declares no `fetchHistory`. */
export const fetchTransactionHistory = async (
    params: FetchTransactionHistoryParams,
): Promise<TransactionHistoryResult> => {
    const adapter = historyChainAdapters.get(params.scope.chainId)
    if (!adapter.fetchHistory) {
        throw new TransactionHistoryRowsUnsupportedError(adapter.chainId)
    }
    return adapter.fetchHistory(params)
}

/**
 * Takes a nextUrl on Pera-backed networks, a next-token on indexer-backed ones.
 * Rejects with {@link TransactionHistoryRowsUnsupportedError} on a chain that
 * declares no `fetchMoreHistory`.
 */
export const fetchMoreTransactions = async (
    params: FetchMoreTransactionsParams,
): Promise<TransactionHistoryResult> => {
    const adapter = historyChainAdapters.get(params.scope.chainId)
    if (!adapter.fetchMoreHistory) {
        throw new TransactionHistoryRowsUnsupportedError(adapter.chainId)
    }
    return adapter.fetchMoreHistory(params)
}

// Not `get`, like assetFactsResolverFor: a chain with no codec has no rows.
export const chainDataCodecOf = (
    chainId: ChainId,
): Optional<HistoryChainDataCodec> =>
    historyChainAdapters.has(chainId)
        ? historyChainAdapters.get(chainId).chainData
        : undefined

/** Throws {@link TransactionHistoryRowsUnsupportedError} on a chain with no codec. */
export const chainDataCodecFor = (chainId: ChainId): HistoryChainDataCodec => {
    const codec = chainDataCodecOf(chainId)
    if (!codec) throw new TransactionHistoryRowsUnsupportedError(chainId)
    return codec
}

/** No-op on a chain with no repair. Never throws: a failed repair must not fail the sync that already stored its page. */
export const healCachedRows = async (
    accountAddress: string,
    scope: ChainScope,
): Promise<void> => {
    try {
        await historyChainAdapters
            .get(scope.chainId)
            .healCachedRows?.({ scope, accountAddress })
    } catch (error) {
        logger.warn('history repair failed', { error, chainId: scope.chainId })
    }
}

/**
 * Throws {@link TransactionHistoryRowsUnsupportedError} on a chain with no
 * `summarize`: such a chain never stores the rows this reads.
 */
export const summarizeHistoryItem = (
    item: TransactionHistoryItem,
    address: string,
    chainId: ChainId,
): TransactionSummary => {
    const adapter = historyChainAdapters.get(chainId)
    if (!adapter.summarize) {
        throw new TransactionHistoryRowsUnsupportedError(adapter.chainId)
    }
    return adapter.summarize(item, address)
}

/** Null when the chain has no `toTransactionNative`. */
export const mapHistoryItemToTransactionNative = (
    item: TransactionHistoryItem,
    chainId: ChainId,
): Nullable<TransactionNative> =>
    historyChainAdapters.get(chainId).toTransactionNative?.(item) ?? null

/** Null when the chain declares no `groupToOpen`, or the row opens its own detail. */
export const historyItemGroupToOpen = (
    item: TransactionHistoryItem,
    chainId: ChainId,
): Nullable<string> =>
    historyChainAdapters.get(chainId).groupToOpen?.(item) ?? null
