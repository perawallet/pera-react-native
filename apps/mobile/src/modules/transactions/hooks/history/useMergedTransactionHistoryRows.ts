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

import { useCallback, useMemo, useRef, useState } from 'react'
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
    /** Reads the next page of whichever networks hold the list back. */
    fetchNextPage: () => void
    /** Resumes every network whose search paused. */
    searchOlder: () => void
    retry: () => void
    refresh: () => void
}

const feedKeyOf = ({ scope, address }: HistoryFeedSource): string =>
    `${toScopeKey(scope)}:${address}`

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

    const runOn = useCallback(
        (indexes: number[], action: keyof HistoryFeedActions) => {
            for (const index of indexes) {
                actionsRef.current.get(feedKeys[index]!)?.[action]()
            }
        },
        [feedKeys],
    )
    const fetchNextPage = useCallback(
        () => runOn(blockingFeeds, 'fetchNextPage'),
        [runOn, blockingFeeds],
    )
    const searchOlder = useCallback(
        () => runOn(pausedFeeds, 'fetchNextPage'),
        [runOn, pausedFeeds],
    )
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

    return {
        ...history,
        feeds,
        fetchNextPage,
        searchOlder,
        retry,
        refresh,
    }
}
