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

import { useEffect, useMemo, useRef } from 'react'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import type {
    HistoryFeedActions,
    HistoryFeedProps,
} from '../../hooks/history/useMergedTransactionHistoryRows'
import { useTransactionHistoryRows } from '../../hooks/history/useTransactionHistoryRows'

export const useTransactionHistoryFeed = ({
    feedKey,
    source,
    afterTime,
    beforeTime,
    onChange,
}: HistoryFeedProps): void => {
    const { scope, address } = source
    const history = useTransactionHistoryRows({
        accountAddress: address,
        scope,
        afterTime,
        beforeTime,
    })
    const addresses = useMemo(() => [address], [address])
    const { isRefreshing, refresh } = useSyncRefresh({ addresses, scope })

    // The history query's page functions are new every render; reporting them
    // would re-run the effect below in a loop.
    const latest = useRef({ history, refresh })
    useEffect(() => {
        latest.current = { history, refresh }
    })
    const actions = useMemo<HistoryFeedActions>(
        () => ({
            fetchNextPage: () => latest.current.history.fetchNextPage(),
            retry: () => latest.current.history.retry(),
            refresh: () => latest.current.refresh(),
        }),
        [],
    )

    const {
        rows,
        isLoading,
        isFetched,
        isFetchingNextPage,
        isError,
        error,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        hasNextPage,
        isSearchPaused,
        isRetrying,
        suspectedPoisoningById,
    } = history

    useEffect(() => {
        onChange(
            feedKey,
            {
                scope,
                rows,
                isLoading,
                isFetched,
                isFetchingNextPage,
                isError,
                error,
                isLoadFailed,
                isLoadUnavailable,
                isLoadIntegrityBlocked,
                hasNextPage,
                isSearchPaused,
                isRetrying,
                isRefreshing,
                suspectedPoisoningById,
            },
            actions,
        )
    }, [
        onChange,
        feedKey,
        actions,
        scope,
        rows,
        isLoading,
        isFetched,
        isFetchingNextPage,
        isError,
        error,
        isLoadFailed,
        isLoadUnavailable,
        isLoadIntegrityBlocked,
        hasNextPage,
        isSearchPaused,
        isRetrying,
        isRefreshing,
        suspectedPoisoningById,
    ])

    useEffect(
        () => () => onChange(feedKey, null, actions),
        [onChange, feedKey, actions],
    )
}
