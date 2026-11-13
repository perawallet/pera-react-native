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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import { useDiscoverNewsQuery } from '@perawallet/wallet-core-discover'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    AnalyticsMetadataKey as Key,
    DiscoverEvent,
    trackEvent,
} from '@analytics'
import type { FilterOption } from '@components/FilterSelection'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { toChainFilterOptions } from '@modules/assets'
import { useDiscoverChainIds } from '../../hooks/useDiscoverChainIds'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useTopDapps, type UseTopDappsResult } from '../../hooks/useTopDapps'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import { formatNewsDate } from '../../utils/formatNewsDate'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'

export type DiscoverNewsCardItem = {
    id: string
    title: string
    banner: Nullable<string>
    dateDisplay: string
}

export type UseDiscoverHomeScreenResult = {
    chainOptions: FilterOption<Nullable<ChainId>>[]
    selectedChainId: Nullable<ChainId>
    selectedChainName: string
    selectChain: (id: Nullable<ChainId>) => void
    topDapps: UseTopDappsResult
    news: { items: DiscoverNewsCardItem[]; isLoading: boolean }
    isFavorite: (url: string) => boolean
    isVerified: (url: string) => boolean
    toggleFavorite: (dapp: DiscoverDapp) => void
    isRefreshing: boolean
    refresh: () => Promise<void>
    openSearch: () => void
    openDapp: (dapp: DiscoverDapp) => void
}

export const useDiscoverHomeScreen = (): UseDiscoverHomeScreenResult => {
    const navigation = useAppNavigation()
    const { openDapp: openDappPage } = useOpenDapp()
    const toggle = useToggleDiscoverFavorite()
    const discoverChainIds = useDiscoverChainIds()
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    const newsQuery = useDiscoverNewsQuery()

    const [pickedChainId, setPickedChainId] = useState<Nullable<ChainId>>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // No All chip: every Top dApps list is one chain's. The picked chain holds
    // only while it still supports discover.
    const chainOptions = useMemo(
        () =>
            toChainFilterOptions(discoverChainIds, {
                testIDPrefix: 'discover_chain_filter',
            }),
        [discoverChainIds],
    )
    const selectedChainId =
        pickedChainId !== null && discoverChainIds.includes(pickedChainId)
            ? pickedChainId
            : (discoverChainIds[0] ?? null)
    const selectedChainName =
        selectedChainId === null
            ? ''
            : (chainDisplayNameOf(selectedChainId) ?? selectedChainId)

    const selectChain = useCallback((id: Nullable<ChainId>) => {
        setPickedChainId(id)
        const name = id === null ? '' : (chainDisplayNameOf(id) ?? id)
        trackEvent(DiscoverEvent.DappFilterTap, {
            [Key.FilterName]: name,
            ...(id === null ? {} : { [Key.ChainId]: id }),
        })
    }, [])

    const topDapps = useTopDapps(selectedChainId)

    const verifiedUrls = topDapps.verifiedUrls
    const isVerified = useCallback(
        (url: string) => verifiedUrls.has(normalizeDappUrl(url) ?? ''),
        [verifiedUrls],
    )
    const isFavorite = useCallback(
        (url: string) => {
            const key = normalizeDappUrl(url)
            return key !== null && key in favorites
        },
        [favorites],
    )
    const toggleFavorite = useCallback(
        (dapp: DiscoverDapp) => {
            toggle(dapp, selectedChainId)
        },
        [toggle, selectedChainId],
    )
    const openDapp = useCallback(
        (dapp: DiscoverDapp) => {
            openDappPage(dapp, selectedChainId)
        },
        [openDappPage, selectedChainId],
    )

    const newsData = newsQuery.data
    const newsItems = useMemo(
        () =>
            (newsData ?? []).map(item => ({
                id: item.id,
                title: item.title,
                banner: item.banner,
                dateDisplay: formatNewsDate(item.publishedAt),
            })),
        [newsData],
    )
    const news = useMemo(
        () => ({ items: newsItems, isLoading: newsQuery.isLoading }),
        [newsItems, newsQuery.isLoading],
    )

    const topDappsRefetch = topDapps.refetch
    const newsRefetch = newsQuery.refetch
    const refresh = useCallback(async () => {
        setIsRefreshing(true)
        try {
            await Promise.all([topDappsRefetch(), newsRefetch()])
        } finally {
            setIsRefreshing(false)
        }
    }, [topDappsRefetch, newsRefetch])

    const openSearch = useCallback(() => {
        trackEvent(DiscoverEvent.SearchBarTap)
        navigation.navigate('DiscoverSearch')
    }, [navigation])

    return {
        chainOptions,
        selectedChainId,
        selectedChainName,
        selectChain,
        topDapps,
        news,
        isFavorite,
        isVerified,
        toggleFavorite,
        isRefreshing,
        refresh,
        openSearch,
        openDapp,
    }
}
