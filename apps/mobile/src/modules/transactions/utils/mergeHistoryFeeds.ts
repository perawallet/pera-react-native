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
} from '@perawallet/wallet-core-chain-contract'
import type { SuspectedPoisoning } from '@perawallet/wallet-core-transactions'
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
    hasNextPage: boolean
    isSearchPaused: boolean
    isRetrying: boolean
    isRefreshing: boolean
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
}

export type MergedHistory = {
    rows: TransactionListRow[]
    transactionCount: number
    isLoading: boolean
    isFetched: boolean
    isFetchingNextPage: boolean
    isError: boolean
    error: Nullable<Error>
    isLoadFailed: boolean
    isLoadUnavailable: boolean
    isLoadIntegrityBlocked: boolean
    hasNextPage: boolean
    isSearchPaused: boolean
    isRetrying: boolean
    isRefreshing: boolean
    suspectedPoisoningById: ReadonlyMap<string, SuspectedPoisoning>
    /** Keyed by transaction id. */
    scopeByTransactionId: ReadonlyMap<string, ChainScope>
    /** Networks whose last read failed; their rows may be missing from `rows`. */
    failedChainIds: ChainId[]
    /** Indexes of the feeds whose next page decides what shows next. */
    blockingFeeds: number[]
    /** Indexes of the feeds whose search paused; Search Older resumes them. */
    pausedFeeds: number[]
    /** Indexes of the feeds whose last read failed. */
    failedFeeds: number[]
}

const isEntryRow = (row: TransactionListRow): row is TransactionEntryRow =>
    row.kind !== TRANSACTION_ROW_TYPES.header

/**
 * Interleaves several networks' histories newest first. A feed with pages left
 * hides other feeds' rows older than its oldest loaded one, or its next page
 * would land above rows the user already scrolled past.
 */
export const mergeHistoryFeeds = (
    feeds: readonly Optional<HistoryFeedSnapshot>[],
): MergedHistory => {
    const entriesByFeed = feeds.map(feed =>
        (feed?.rows ?? []).filter(isEntryRow).map(row => ({
            ...row,
            networkChainId: feed!.scope.chainId,
        })),
    )

    // A failed or paused feed loads nothing more on its own, so it holds nothing back.
    const frontierOf = (index: number): Nullable<number> => {
        const feed = feeds[index]
        // Not reported yet: it could hold the newest rows.
        if (!feed) return Number.POSITIVE_INFINITY
        if (feed.isError || feed.isSearchPaused) return null
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

    const visible = entriesByFeed
        .flat()
        .filter(row => entryRowTimestampOf(row) >= cutoff)
    const rows = buildMergedListRows(visible)

    const reported = feeds.filter(
        (feed): feed is HistoryFeedSnapshot => feed !== undefined,
    )
    const failedFeeds = feeds.flatMap((feed, index) =>
        feed?.isError ? [index] : [],
    )
    const pausedFeeds = feeds.flatMap((feed, index) =>
        feed?.isSearchPaused ? [index] : [],
    )
    const isLoadFailed =
        visible.length === 0 &&
        blockingFeeds.length === 0 &&
        failedFeeds.length > 0
    const failed = failedFeeds.map(index => feeds[index]!)

    const scopeByTransactionId = new Map<string, ChainScope>()
    const suspectedPoisoningById = new Map<string, SuspectedPoisoning>()
    for (const feed of reported) {
        for (const row of feed.rows) {
            if (isEntryRow(row)) scopeByTransactionId.set(row.key, feed.scope)
        }
        for (const [id, suspected] of feed.suspectedPoisoningById) {
            suspectedPoisoningById.set(id, suspected)
        }
    }

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
        isLoadUnavailable:
            isLoadFailed && failed.every(feed => feed.isLoadUnavailable),
        isLoadIntegrityBlocked:
            isLoadFailed && failed.some(feed => feed.isLoadIntegrityBlocked),
        hasNextPage: blockingFeeds.length > 0,
        isSearchPaused: blockingFeeds.length === 0 && pausedFeeds.length > 0,
        isRetrying: reported.some(feed => feed.isRetrying),
        isRefreshing: reported.some(feed => feed.isRefreshing),
        suspectedPoisoningById,
        scopeByTransactionId,
        failedChainIds: [...new Set(failed.map(feed => feed.scope.chainId))],
        blockingFeeds,
        pausedFeeds,
        failedFeeds,
    }
}
