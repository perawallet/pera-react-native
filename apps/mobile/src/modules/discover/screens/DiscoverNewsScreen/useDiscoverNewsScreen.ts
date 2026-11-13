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

import { useCallback, useMemo, useState } from 'react'
import { useDiscoverNewsQuery } from '@perawallet/wallet-core-discover'
import {
    AnalyticsMetadataKey as Key,
    DiscoverEvent,
    trackEvent,
} from '@analytics'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { formatNewsDate } from '../../utils/formatNewsDate'
import type { DiscoverNewsCardItem } from '../DiscoverHomeScreen/useDiscoverHomeScreen'

export type UseDiscoverNewsScreenResult = {
    items: DiscoverNewsCardItem[]
    isLoading: boolean
    isError: boolean
    isRefreshing: boolean
    refresh: () => Promise<void>
    retry: () => void
    openNewsItem: (item: DiscoverNewsCardItem) => void
}

export const useDiscoverNewsScreen = (): UseDiscoverNewsScreenResult => {
    const navigation = useAppNavigation()
    const query = useDiscoverNewsQuery()
    const [isRefreshing, setIsRefreshing] = useState(false)

    const data = query.data
    const items = useMemo(
        () =>
            (data ?? []).map(item => ({
                id: item.id,
                title: item.title,
                banner: item.banner,
                dateDisplay: formatNewsDate(item.publishedAt),
            })),
        [data],
    )

    const refetch = query.refetch
    const refresh = useCallback(async () => {
        setIsRefreshing(true)
        try {
            await refetch()
        } finally {
            setIsRefreshing(false)
        }
    }, [refetch])
    const retry = useCallback(() => {
        void refetch()
    }, [refetch])

    const openNewsItem = useCallback(
        (item: DiscoverNewsCardItem) => {
            trackEvent(DiscoverEvent.NewsOpenTap, {
                [Key.NewsTitle]: item.title,
            })
            navigation.navigate('DiscoverNewsDetail', { newsId: item.id })
        },
        [navigation],
    )

    // A retry after an error keeps status 'error' while it runs; show it loading.
    const isRetrying = query.isError && query.isFetching
    return {
        items,
        isLoading: query.isLoading || isRetrying,
        isError: query.isError && !query.isFetching,
        isRefreshing,
        refresh,
        retry,
        openNewsItem,
    }
}
