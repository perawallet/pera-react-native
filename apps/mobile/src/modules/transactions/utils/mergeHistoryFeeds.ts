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

import type {
    ChainId,
    ChainScope,
    TransactionSwapLeg,
} from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import {
    withoutListedSwapPayoutsBy,
    type SuspectedPoisoning,
} from '@perawallet/wallet-core-transactions'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    TRANSACTION_ROW_TYPES,
    buildMergedListRows,
    entryRowTimestampOf,
    type TransactionEntryRow,
    type TransactionListRow,
} from './transactionListRows'

/** One network's history as its feed last reported it. */
export type HistoryFeedSnapshot = {
    scope: ChainScope
    rows: TransactionListRow[]
    isLoading: boolean
    isFetched: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    isLoadFailed: boolean
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    isRefreshFailed: boolean
    isRefreshUnavailable: boolean
    hasNextPage: boolean
    isSearchPaused: boolean
    isRetrying: boolean
    isRefreshing: boolean
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
    /**
     * Set on a network read only for the swaps it paid into the shown one: it
     * lists those orders' source rows alone, never pages and never reports a
     * failure, since the list isn't that network's history.
     */
    onlySwapOrderIds?: ReadonlySet<string>
}

export type MergedHistory = {
    rows: TransactionListRow[]
    transactionCount: number
    isLoading: boolean
    isFetched: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    /** Every network failed with nothing loaded; one failing beside others that loaded, even empty, shows in `failedChainIds` instead. */
    isLoadFailed: boolean
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    /** Some network failed while rows show; `failedChainIds` names it. */
    isRefreshFailed: boolean
    hasNextPage: boolean
    isSearchPaused: boolean
    isRetrying: boolean
    isRefreshing: boolean
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
    /** Keyed by transaction id. */
    scopeByTransactionId: ReadonlyMap<string, ChainScope>
    /**
     * Networks that failed with nothing loaded, or with only their own sends
     * listed, and that a retry can clear. Empty when `isLoadFailed`: the full
     * screen says it.
     */
    failedChainIds: ChainId[]
    /** `failedChainIds` by display name, for the failed-network notice. */
    failedNetworkNames: string[]
    /** Networks that failed for want of a history service. Empty when `isLoadUnavailable`. */
    unavailableChainIds: ChainId[]
    /** `unavailableChainIds` by display name. */
    unavailableNetworkNames: string[]
    /** Indexes of the feeds whose next page decides what shows next. */
    blockingFeeds: number[]
    /** Indexes of the feeds whose search paused; Search Older resumes them. */
    pausedFeeds: number[]
    /** Indexes of the feeds whose last read failed, a later page's included, and that a retry can clear; Retry re-reads them. */
    failedFeeds: number[]
}

const isUnsupportedFeed = (feed: HistoryFeedSnapshot): boolean =>
    feed.isLoadUnavailable || feed.isRefreshUnavailable

const isEntryRow = (row: TransactionListRow): row is TransactionEntryRow =>
    row.kind !== TRANSACTION_ROW_TYPES.header

/** Keyed by lowercase transaction id. */
export type KnownSwapLegs = ReadonlyMap<string, TransactionSwapLeg>

/**
 * Interleaves several networks' histories newest first. A feed with pages left
 * hides other feeds' rows older than its oldest loaded one, or its next page
 * would land above rows the user already scrolled past.
 *
 * A swap's payout is dropped while its source leg is listed, whichever network
 * each is on, so the source row stands for the whole swap. `knownSwapLegs`
 * names legs the history backend hasn't linked to their order yet.
 */
export const mergeHistoryFeeds = (
    allFeeds: readonly Optional<HistoryFeedSnapshot>[],
    knownSwapLegs?: KnownSwapLegs,
): MergedHistory => {
    const legOf = (row: TransactionEntryRow) =>
        (row.kind === TRANSACTION_ROW_TYPES.record
            ? row.record.swapLeg
            : undefined) ?? knownSwapLegs?.get(row.key.toLowerCase())
    const entriesByFeed = allFeeds.map(feed => {
        const entries = (feed?.rows ?? []).filter(isEntryRow)
        const orderIds = feed?.onlySwapOrderIds
        if (!orderIds) return entries
        return entries.filter(row => {
            const leg = legOf(row)
            return leg?.role === 'source' && orderIds.has(leg.orderId)
        })
    })
    // A swaps-only feed lists rows, but its paging and failures aren't this list's.
    const feeds = allFeeds.map(feed =>
        feed?.onlySwapOrderIds
            ? {
                  ...feed,
                  hasNextPage: false,
                  isSearchPaused: false,
                  isError: false,
                  isLoadFailed: false,
                  isRefreshFailed: false,
                  isRetrying: false,
              }
            : feed,
    )

    // A feed that loaded nothing or paused holds nothing back. One whose later
    // page failed still does: its missing rows may be newer than others' next ones.
    const frontierOf = (index: number): Nullable<number> => {
        const feed = feeds[index]
        // Not reported yet: it could hold the newest rows.
        if (!feed) return Number.POSITIVE_INFINITY
        if (feed.isLoadFailed || feed.isSearchPaused) return null
        if (feed.isFetched && !feed.hasNextPage) return null
        return Math.min(
            Number.POSITIVE_INFINITY,
            ...entriesByFeed[index]!.map(entryRowTimestampOf),
        )
    }
    const frontiers = feeds.map((_, index) => frontierOf(index))
    const cutoff = Math.max(
        Number.NEGATIVE_INFINITY,
        ...frontiers.filter(
            (frontier): frontier is number => frontier !== null,
        ),
    )
    const blockingFeeds = frontiers.flatMap((frontier, index) =>
        frontier !== null && frontier === cutoff ? [index] : [],
    )

    const visible = withoutListedSwapPayoutsBy(
        entriesByFeed.flat().filter(row => entryRowTimestampOf(row) >= cutoff),
        legOf,
    )
    const rows = buildMergedListRows(visible)

    const reported = feeds.filter(
        (feed): feed is HistoryFeedSnapshot => feed !== undefined,
    )
    const erroredFeeds = feeds.flatMap((feed, index) =>
        feed?.isError ? [index] : [],
    )
    const failedFeeds = erroredFeeds.filter(
        index => !isUnsupportedFeed(feeds[index]!),
    )
    const pausedFeeds = feeds.flatMap((feed, index) =>
        feed?.isSearchPaused ? [index] : [],
    )
    const failed = erroredFeeds.map(index => feeds[index]!)
    const loadFailed = failed.filter(feed => feed.isLoadFailed)
    const historyFeedCount = feeds.filter(
        feed => !feed?.onlySwapOrderIds,
    ).length
    const isLoadFailed =
        historyFeedCount > 0 && loadFailed.length === historyFeedCount
    const isLoadUnavailable =
        isLoadFailed && loadFailed.every(feed => feed.isLoadUnavailable)
    const chainIdsOf = (list: HistoryFeedSnapshot[]): ChainId[] => [
        ...new Set(list.map(feed => feed.scope.chainId)),
    ]
    const failedChainIds = isLoadFailed
        ? []
        : chainIdsOf(
              failed.filter(
                  feed =>
                      !isUnsupportedFeed(feed) &&
                      (feed.isLoadFailed || feed.isRefreshFailed),
              ),
          )
    const unavailableChainIds = isLoadUnavailable
        ? []
        : chainIdsOf(failed.filter(isUnsupportedFeed))
    const nameOf = (chainId: ChainId): string =>
        chainDisplayNameOf(chainId) ?? chainId

    const scopeByTransactionId = new Map<string, ChainScope>()
    const suspectedPoisoningById = new Map<string, SuspectedPoisoning>()
    reported.forEach(feed => {
        const index = feeds.indexOf(feed)
        for (const row of entriesByFeed[index] ?? []) {
            scopeByTransactionId.set(row.key, feed.scope)
        }
        for (const [id, suspected] of feed.suspectedPoisoningById) {
            suspectedPoisoningById.set(id, suspected)
        }
    })

    return {
        rows,
        transactionCount: visible.length,
        isLoading: reported.some(feed => feed.isLoading),
        isFetched:
            reported.length === feeds.length &&
            reported.every(feed => feed.isFetched),
        isFetchingNextPage: reported.some(feed => feed.isFetchingNextPage),
        isError: failed.length > 0,
        error: failed[0]?.error ?? null,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked:
            isLoadFailed &&
            loadFailed.some(feed => feed.isLoadIntegrityBlocked),
        hasNextPage: blockingFeeds.length > 0,
        isSearchPaused: blockingFeeds.length === 0 && pausedFeeds.length > 0,
        isRetrying: reported.some(feed => feed.isRetrying),
        isRefreshing: reported.some(feed => feed.isRefreshing),
        suspectedPoisoningById,
        scopeByTransactionId,
        isRefreshFailed: failedChainIds.length > 0,
        failedChainIds,
        failedNetworkNames: failedChainIds.map(nameOf),
        unavailableChainIds,
        unavailableNetworkNames: unavailableChainIds.map(nameOf),
        blockingFeeds,
        pausedFeeds,
        failedFeeds,
    }
}
