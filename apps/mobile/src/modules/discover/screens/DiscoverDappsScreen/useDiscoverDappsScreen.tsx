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
import { Linking } from 'react-native'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    i18nKey,
    type ChainId,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    AnalyticsMetadataKey as Key,
    DiscoverEvent,
    trackEvent,
} from '@analytics'
import type { FilterOption } from '@components/FilterSelection'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useBottomSheet } from '@modules/bottom-sheet'
import { toChainFilterOptions } from '@modules/assets'
import type { RootStackParamList } from '@routes/types'
import {
    DappDetailsSheet,
    type DappDetailsSheetResult,
} from '../../components/DappDetailsSheet'
import { useDiscoverChainIds } from '../../hooks/useDiscoverChainIds'
import { useDiscoverDirectory } from '../../hooks/useDiscoverDirectory'
import { useOpenDapp } from '../../hooks/useOpenDapp'
import { useToggleDiscoverFavorite } from '../../hooks/useToggleDiscoverFavorite'
import { useDiscoverFavoritesStore } from '../../store/useDiscoverFavoritesStore'
import type { DiscoverDapp } from '../../types'
import {
    directoryCategories,
    filterDirectory,
    toDirectoryDapps,
    type DappSort,
    type DirectoryDapp,
} from '../../utils/dappDirectory'
import { normalizeDappUrl } from '../../utils/normalizeDappUrl'

// The web app's verification form; it opens outside the app, as on the web.
const APPLY_FOR_DISCOVER_URL =
    'https://explorer.perawallet.app/project-verification/'

// English labels go to analytics so events do not split by language.
const SORTS: { id: DappSort; labelKey: I18nKey; analyticsName: string }[] = [
    {
        id: 'popular',
        labelKey: i18nKey('discover.dapps.sort_popular'),
        // oxlint-disable-next-line pera/no-hardcoded-ui-strings -- analytics value matching the web app's event, never shown
        analyticsName: 'Popular',
    },
    {
        id: 'a-z',
        labelKey: i18nKey('discover.dapps.sort_alphabetical'),
        // oxlint-disable-next-line pera/no-hardcoded-ui-strings -- analytics value matching the web app's event, never shown
        analyticsName: 'Alphabetical (A-Z)',
    },
]
const ALL_ANALYTICS_NAME = 'All'

export type DappSortOption = { id: DappSort; label: string }

export type UseDiscoverDappsScreenResult = {
    chainOptions: FilterOption<Nullable<ChainId>>[]
    selectedChainId: Nullable<ChainId>
    selectedChainName: string
    selectChain: (id: Nullable<ChainId>) => void
    sort: DappSort
    sortLabel: string
    sortOptions: DappSortOption[]
    selectSort: (id: DappSort) => void
    categoryOptions: FilterOption<Nullable<string>>[]
    selectedCategory: Nullable<string>
    selectCategory: (category: Nullable<string>) => void
    items: DirectoryDapp[]
    showChains: boolean
    isLoading: boolean
    isError: boolean
    retry: () => void
    isFavorite: (url: string) => boolean
    isVerified: (url: string) => boolean
    toggleFavorite: (dapp: DiscoverDapp) => void
    openDapp: (dapp: DiscoverDapp) => void
    openDetails: (item: DirectoryDapp) => Promise<void>
    openSearch: () => void
    applyForDiscover: () => void
}

export const useDiscoverDappsScreen = (): UseDiscoverDappsScreenResult => {
    const { t } = useLanguage()
    const navigation = useAppNavigation()
    const { request } = useBottomSheet()
    const route = useRoute<RouteProp<RootStackParamList, 'DiscoverDapps'>>()
    const { openDapp: openDappPage } = useOpenDapp()
    const toggle = useToggleDiscoverFavorite()
    const favorites = useDiscoverFavoritesStore(s => s.favorites)
    const discoverChainIds = useDiscoverChainIds()
    const directory = useDiscoverDirectory()

    const [pickedChainId, setPickedChainId] = useState<Nullable<ChainId>>(
        route.params?.chainId ?? null,
    )
    const [sort, setSort] = useState<DappSort>('popular')
    const [pickedCategory, setPickedCategory] = useState<Nullable<string>>(null)

    const allLabel = t('discover.search.filter_all')
    const chainOptions = useMemo(
        () =>
            toChainFilterOptions(discoverChainIds, {
                allLabel,
                testIDPrefix: 'discover_dapps_chain',
            }),
        [discoverChainIds, allLabel],
    )
    // A chain that lost Discover (or never had it) reads as All.
    const selectedChainId =
        pickedChainId !== null && discoverChainIds.includes(pickedChainId)
            ? pickedChainId
            : null
    const selectedChainName =
        selectedChainId === null
            ? ''
            : (chainDisplayNameOf(selectedChainId) ?? selectedChainId)

    const all = useMemo(
        () => toDirectoryDapps(directory.projects),
        [directory.projects],
    )
    // Filtered by chain only, in API order: the category chips come from this
    // list, so their order does not move with the sort.
    const onChain = useMemo(
        () =>
            selectedChainId === null
                ? all
                : all.filter(({ dapp }) =>
                      dapp.chains.includes(selectedChainId),
                  ),
        [all, selectedChainId],
    )
    const categories = useMemo(() => directoryCategories(onChain), [onChain])
    const selectedCategory =
        pickedCategory !== null && categories.includes(pickedCategory)
            ? pickedCategory
            : null
    const items = useMemo(
        () =>
            filterDirectory(onChain, {
                chainId: null,
                category: selectedCategory,
                sort,
            }),
        [onChain, selectedCategory, sort],
    )
    const categoryOptions = useMemo(
        () => [
            {
                value: null,
                label: allLabel,
                testID: 'discover_dapps_category_all',
            },
            ...categories.map(category => ({
                value: category,
                label: category,
                testID: `discover_dapps_category_${category}`,
            })),
        ],
        [categories, allLabel],
    )
    const sortOptions = useMemo(
        () => SORTS.map(({ id, labelKey }) => ({ id, label: t(labelKey) })),
        [t],
    )
    const sortLabel =
        sortOptions.find(option => option.id === sort)?.label ?? ''

    // A chain switch starts the category at All, so a category the switch
    // hid never re-selects itself on a later switch.
    const selectChain = useCallback((id: Nullable<ChainId>) => {
        setPickedChainId(id)
        setPickedCategory(null)
        trackEvent(DiscoverEvent.DappFilterTap, {
            [Key.FilterName]:
                id === null
                    ? ALL_ANALYTICS_NAME
                    : (chainDisplayNameOf(id) ?? id),
            ...(id === null ? {} : { [Key.ChainId]: id }),
        })
    }, [])
    const selectSort = useCallback(
        (id: DappSort) => {
            setSort(id)
            trackEvent(DiscoverEvent.DappFilterTap, {
                [Key.FilterName]:
                    SORTS.find(option => option.id === id)?.analyticsName ?? id,
                ...(selectedChainId === null
                    ? {}
                    : { [Key.ChainId]: selectedChainId }),
            })
        },
        [selectedChainId],
    )
    const selectCategory = useCallback(
        (category: Nullable<string>) => {
            setPickedCategory(category)
            trackEvent(DiscoverEvent.DappCategoryTap, {
                [Key.CategoryName]: category ?? ALL_ANALYTICS_NAME,
                ...(selectedChainId === null
                    ? {}
                    : { [Key.ChainId]: selectedChainId }),
            })
        },
        [selectedChainId],
    )

    const verifiedUrls = directory.verifiedUrls
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
        (dapp: DiscoverDapp) => toggle(dapp, selectedChainId),
        [toggle, selectedChainId],
    )
    const openDapp = useCallback(
        (dapp: DiscoverDapp) => openDappPage(dapp, selectedChainId),
        [openDappPage, selectedChainId],
    )
    const openDetails = useCallback(
        async (item: DirectoryDapp) => {
            const dappPayload = {
                [Key.DappName]: item.dapp.name,
                ...(selectedChainId === null
                    ? {}
                    : { [Key.ChainId]: selectedChainId }),
            }
            trackEvent(DiscoverEvent.DappDetailsButtonTap, dappPayload)
            const result = await request<DappDetailsSheetResult>({
                contents: (
                    <DappDetailsSheet
                        item={item}
                        chainId={selectedChainId}
                        isVerified={isVerified(item.dapp.url)}
                    />
                ),
                options: { size: 'auto', enablePanDownToClose: true },
            })
            if (result === undefined) {
                trackEvent(DiscoverEvent.DetailsCloseTap, dappPayload)
            }
        },
        [request, selectedChainId, isVerified],
    )
    const openSearch = useCallback(() => {
        trackEvent(DiscoverEvent.SearchBarTap)
        navigation.navigate('DiscoverSearch')
    }, [navigation])
    const applyForDiscover = useCallback(() => {
        trackEvent(DiscoverEvent.ApplyForVerificationTap, {
            [Key.Category]: 'project',
        })
        // oxlint-disable-next-line pera/no-unvalidated-open-url -- a constant Pera URL
        void Linking.openURL(APPLY_FOR_DISCOVER_URL)
    }, [])
    const directoryRefetch = directory.refetch
    const retry = useCallback(() => {
        void directoryRefetch()
    }, [directoryRefetch])

    return {
        chainOptions,
        selectedChainId,
        selectedChainName,
        selectChain,
        sort,
        sortLabel,
        sortOptions,
        selectSort,
        categoryOptions,
        selectedCategory,
        selectCategory,
        items,
        // Icons only when the list mixes chains (All with chips to pick from).
        showChains: selectedChainId === null && chainOptions.length > 0,
        // A retry after an error keeps status 'error' while it runs; show it loading.
        isLoading:
            directory.isLoading || (directory.isError && directory.isFetching),
        isError: directory.isError && !directory.isFetching,
        retry,
        isFavorite,
        isVerified,
        toggleFavorite,
        openDapp,
        openDetails,
        openSearch,
        applyForDiscover,
    }
}
