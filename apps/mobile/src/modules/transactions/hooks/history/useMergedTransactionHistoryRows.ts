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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    mergeHistoryFeeds,
    type HistoryFeedSnapshot,
    type MergedHistory,
} from '../../utils/mergeHistoryFeeds'

export type HistoryFeedSource = {
    scope: ChainScope
    address: string
}

export type HistoryFeedActions = {
    fetchNextPage: () => void
    retry: () => void
    refresh: () => void
}

/** A null snapshot withdraws the feed: it unmounted. */
export type HistoryFeedChangeHandler = (
    feedKey: string,
    snapshot: Nullable<HistoryFeedSnapshot>,
    actions: HistoryFeedActions,
) => void

/** Props for one `TransactionHistoryFeed`; render one per entry, keyed by `feedKey`. */
export type HistoryFeedProps = {
    feedKey: string
    source: HistoryFeedSource
    afterTime?: string
    beforeTime?: string
    onChange: HistoryFeedChangeHandler
}

export type UseMergedTransactionHistoryRowsParams = {
    /** Empty turns the merge off: no feed mounts. */
    sources: readonly HistoryFeedSource[]
    /** `YYYY-MM-DD`, inclusive. */
    afterTime?: string
    /** `YYYY-MM-DD`, inclusive. */
    beforeTime?: string
}

export type UseMergedTransactionHistoryRowsResult = Omit<
    MergedHistory,
    'blockingFeeds' | 'pausedFeeds' | 'failedFeeds'
> & {
    feeds: HistoryFeedProps[]
    /** Asks for more rows; served from whichever networks hold the list back until a row shows. */
    fetchNextPage: () => void
    /** Resumes every network whose search paused, and a Load More that paused. */
    searchOlder: () => void
    retry: () => void
    refresh: () => void
}

const feedKeyOf = ({ scope, address }: HistoryFeedSource): string =>
    `${toScopeKey(scope)}:${address}`

/** Page reads one Load More makes without a new row before pausing for Search Older, as the records query does. */
export const MAX_MERGED_LOAD_ROUNDS = 4

type LoadRequest = {
    shownAtRequest: number
    rounds: number
    /** The holding-back feeds' snapshots when the last round fired; the next waits until each reports again. */
    firedWith: ReadonlyMap<string, HistoryFeedSnapshot>
}

/**
 * Several networks' histories as one list. A hook can't call
 * `useTransactionHistoryRows` a varying number of times, so the caller mounts
 * a `TransactionHistoryFeed` per entry of `feeds` and each reports back here.
 */
export const useMergedTransactionHistoryRows = ({
    sources,
    afterTime,
    beforeTime,
}: UseMergedTransactionHistoryRowsParams): UseMergedTransactionHistoryRowsResult => {
    const [snapshots, setSnapshots] = useState<
        Readonly<Record<string, HistoryFeedSnapshot>>
    >({})
    // Feed actions call into query objects whose functions change every
    // render, so the feed hands over stable wrappers once and they live here
    // rather than in state.
    const actionsRef = useRef(new Map<string, HistoryFeedActions>())

    const handleFeedChange = useCallback<HistoryFeedChangeHandler>(
        (feedKey, snapshot, actions) => {
            if (snapshot) {
                actionsRef.current.set(feedKey, actions)
            } else {
                actionsRef.current.delete(feedKey)
            }
            setSnapshots(previous => {
                if (snapshot) return { ...previous, [feedKey]: snapshot }
                const next = { ...previous }
                delete next[feedKey]
                return next
            })
        },
        [],
    )

    const feedKeys = useMemo(() => sources.map(feedKeyOf), [sources])
    const merged = useMemo(
        () => mergeHistoryFeeds(feedKeys.map(key => snapshots[key])),
        [feedKeys, snapshots],
    )

    const feeds = useMemo(
        () =>
            sources.map((source, index) => ({
                feedKey: feedKeys[index]!,
                source,
                afterTime,
                beforeTime,
                onChange: handleFeedChange,
            })),
        [sources, feedKeys, afterTime, beforeTime, handleFeedChange],
    )

    const { blockingFeeds, pausedFeeds, failedFeeds, ...history } = merged
    const { transactionCount } = history

    const runOn = useCallback(
        (indexes: number[], action: keyof HistoryFeedActions) => {
            for (const index of indexes) {
                actionsRef.current.get(feedKeys[index]!)?.[action]()
            }
        },
        [feedKeys],
    )
    // A list's end fires once per content change, and another feed's read
    // (an auto-walk, a refresh) or a page with nothing to show changes nothing
    // on screen. So Load More is kept as a request and served until a row
    // shows, rather than dropped when a feed happens to be busy.
    const [loadRequest, setLoadRequest] = useState<Nullable<LoadRequest>>(null)
    const [isLoadPaused, setIsLoadPaused] = useState(false)

    useEffect(() => {
        setLoadRequest(null)
        setIsLoadPaused(false)
    }, [feedKeys, afterTime, beforeTime])

    useEffect(() => {
        if (!loadRequest) return
        if (
            blockingFeeds.length === 0 ||
            transactionCount > loadRequest.shownAtRequest
        ) {
            setLoadRequest(null)
            return
        }
        const blockers = blockingFeeds.map(index => feedKeys[index]!)
        const isWaiting = blockers.some(key => {
            const snapshot = snapshots[key]
            return (
                !snapshot ||
                !snapshot.isFetched ||
                snapshot.isFetchingNextPage ||
                snapshot.isRetrying ||
                loadRequest.firedWith.get(key) === snapshot
            )
        })
        if (isWaiting) return
        // A failed page or a long empty stretch waits for Search Older.
        const hasFailedPage = blockers.some(key => snapshots[key]!.isError)
        if (hasFailedPage || loadRequest.rounds >= MAX_MERGED_LOAD_ROUNDS) {
            setLoadRequest(null)
            setIsLoadPaused(true)
            return
        }
        runOn(blockingFeeds, 'fetchNextPage')
        setLoadRequest({
            ...loadRequest,
            rounds: loadRequest.rounds + 1,
            firedWith: new Map(blockers.map(key => [key, snapshots[key]!])),
        })
    }, [
        loadRequest,
        blockingFeeds,
        transactionCount,
        snapshots,
        feedKeys,
        runOn,
    ])

    const fetchNextPage = useCallback(() => {
        setLoadRequest(
            previous =>
                previous ?? {
                    shownAtRequest: transactionCount,
                    rounds: 0,
                    firedWith: new Map(),
                },
        )
    }, [transactionCount])
    const searchOlder = useCallback(() => {
        setIsLoadPaused(false)
        runOn(pausedFeeds, 'fetchNextPage')
        if (blockingFeeds.length > 0) {
            setLoadRequest({
                shownAtRequest: transactionCount,
                rounds: 0,
                firedWith: new Map(),
            })
        }
    }, [runOn, pausedFeeds, blockingFeeds, transactionCount])
    const retry = useCallback(
        () => runOn(failedFeeds, 'retry'),
        [runOn, failedFeeds],
    )
    const refresh = useCallback(
        () =>
            runOn(
                feedKeys.map((_, index) => index),
                'refresh',
            ),
        [runOn, feedKeys],
    )

    const isMergePaused = isLoadPaused && blockingFeeds.length > 0
    return {
        ...history,
        isFetchingNextPage: history.isFetchingNextPage || loadRequest !== null,
        isSearchPaused: history.isSearchPaused || isMergePaused,
        feeds,
        fetchNextPage,
        searchOlder,
        retry,
        refresh,
    }
}
