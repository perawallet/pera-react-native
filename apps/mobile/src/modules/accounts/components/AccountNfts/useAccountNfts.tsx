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

import { useCallback, useEffect, useState } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PWFlatList } from '@components/core'
import {
    addressOn,
    useAccountCapabilityScope,
    useAccountHoldingSources,
    useAccountScope,
    useSelectedAccount,
    useAccountCollectiblesQuery,
    useHoldingAcquisitionOrderQuery,
    useCanSignWith,
    type AccountCollectibleLiteRow,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type {
    CollectibleSortMode,
    GalleryLayout,
} from '@perawallet/wallet-core-assets'
import {
    useDebouncedValue,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import { SEARCH_DEBOUNCE_TIME_SHORT } from '@constants/ui'
import type { FilterOption } from '@components/FilterSelection'
import { useCapability } from '@hooks/useCapability'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import { useLanguage } from '@hooks/useLanguage'
import { useAccountChainFilterOptions } from '../../hooks/useAccountChainFilterOptions'
import { useAssetListViewStore } from '../../hooks/useAssetListViewStore'
import { useNftHoldingSources } from '../../hooks/useNftHoldingSources'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'
import { nftListEmptyCopy } from './nftListEmptyCopy'
import { useHoldingSourcesRefresh } from './useHoldingSourcesRefresh'
import {
    galleryViewRequestKey,
    useGalleryScrollReset,
} from './useGalleryScrollReset'
import { useNftGallerySheets } from './useNftGallerySheets'
import { useNftGalleryPreferences } from './useNftGalleryPreferences'
import { useNftGalleryRows } from './useNftGalleryRows'
import { useNftRefreshFailure } from './useNftRefreshFailure'

type UseAccountNftsResult = {
    collectibles: AccountCollectibleLiteRow[]
    collectibleCount: number
    isPending: boolean
    isRefreshing: boolean
    hasAccount: boolean
    canOptIn: boolean
    /** On more than one NFT network, where the copy has to say opt-in is Algorand-only. */
    isMultiChain: boolean
    /** The account's networks, named, when none of them shows NFTs. */
    unsupportedNetworkNames: Optional<string>
    /** No NFTs on any network: an active network chip, search or suspicious filter doesn't count. */
    showEmptyState: boolean
    /** Networks whose last refresh failed while stored NFTs are shown, named; unset hides the notice. */
    refreshNoticeChainNames: Optional<string>
    /** The picked networks failed to load and nothing stored is shown, so the list offers Retry. */
    isLoadFailed: boolean
    handleRetry: () => void
    isRetrying: boolean
    /** Each NFT names its network: several networks are listed together. */
    shouldShowNetwork: boolean
    listEmptyTitle: string
    listEmptyBody: string
    chainFilterOptions: FilterOption<Nullable<ChainId>>[]
    selectedChainId: Nullable<ChainId>
    setSelectedChainId: (chainId: Nullable<ChainId>) => void
    galleryLayout: GalleryLayout
    searchFilter: string
    debouncedSearchFilter: string
    sortMode: CollectibleSortMode
    showOptedIn: boolean
    showWatchAccounts: boolean
    setSearchFilter: (value: string) => void
    setGalleryLayout: (layout: GalleryLayout) => void
    setSortMode: (mode: CollectibleSortMode) => void
    setShowOptedIn: (value: boolean) => void
    setShowWatchAccounts: (value: boolean) => void
    handlePress: (item: AccountCollectibleLiteRow) => void
    handleRefresh: () => void
    openManageSheet: () => Promise<void>
    openAddNftSheet: () => void
    flatListRef: React.MutableRefObject<
        Nullable<React.ComponentRef<typeof PWFlatList>>
    >
}

export const useAccountNfts = (): UseAccountNftsResult => {
    const { t } = useLanguage()
    const account = useSelectedAccount()
    // Opt-in and acquisition order act on the first chain the account holds
    // that can manage assets, so a first chain without it doesn't hide them.
    const home = useHomeChainScope()
    const manageScope = useAccountCapabilityScope(account, 'manageAssets')
    const accountScope = useAccountScope(account, home.chainId)
    const scope = manageScope ?? accountScope
    const sources = useNftHoldingSources(account)
    const address = account ? addressOn(account, scope) : undefined
    const canSign = useCanSignWith(account, scope.chainId)
    // Opt-in only where the gallery would show what it adds.
    const hasNftsOnManageChain = useCapability({
        chain: { chainId: scope.chainId, capability: 'nft' },
    })
    const canOptIn = canSign && manageScope !== null && hasNftsOnManageChain
    const isMultiChain = sources.length > 1
    const allSources = useAccountHoldingSources(account)
    const unsupportedNetworkNames =
        sources.length === 0 && allSources.length > 0
            ? allSources
                  .map(
                      ({ scope }) =>
                          chainDisplayNameOf(scope.chainId) ?? scope.chainId,
                  )
                  .join(', ')
            : undefined
    // Shared with Overview and History, so a chip picked there carries here;
    // a chain the account holds no NFTs on reads as All.
    const selectedChainId =
        useSelectedNetworkSource(sources)?.scope.chainId ?? null
    const setSelectedChainId = useAssetListViewStore(
        state => state.setSelectedChainId,
    )
    const chainFilterOptions = useAccountChainFilterOptions(
        sources,
        'nft_network_filter',
    )
    const [searchFilter, setSearchFilter] = useState('')

    const {
        sortMode,
        galleryLayout,
        showOptedIn,
        showWatchAccounts,
        showSuspicious,
        showHidden,
        setSortMode,
        setGalleryLayout,
        setShowOptedIn,
        setShowWatchAccounts,
    } = useNftGalleryPreferences()

    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const { openAddNftSheet, openManageSheet } = useNftGallerySheets({
        chainId: scope.chainId,
        isMultiChain,
    })

    const { acquisitionOrder } = useHoldingAcquisitionOrderQuery(
        address,
        scope,
        sortMode === 'recentlyAdded',
    )

    // Every network the gallery shows, not only the one opt-ins act on.
    const { isRefreshing, refresh: handleRefresh } =
        useHoldingSourcesRefresh(sources)

    useEffect(() => {
        setSearchFilter('')
    }, [address])

    const debouncedSearchFilter = useDebouncedValue(
        searchFilter,
        SEARCH_DEBOUNCE_TIME_SHORT,
    )

    // Acquisition order lives in a separate chain-backed query, so that one
    // order can't be expressed in SQL. Everything else — the collectible filter, the
    // search, the sort — runs in the engine, and rows come back unparsed.
    const sqlSortMode = sortMode === 'recentlyAdded' ? undefined : sortMode

    const {
        collectibles: rows,
        isPending,
        isPlaceholderData,
        unrefreshedChainIds,
    } = useAccountCollectiblesQuery(sources, {
        sortMode: sqlSortMode,
        search: debouncedSearchFilter || undefined,
        includeZeroBalance: showOptedIn,
    })

    const { collectibles, networkRowCount, isUserHidden, isSuspiciousHidden } =
        useNftGalleryRows({
            rows,
            selectedChainId,
            showHidden,
            showSuspicious,
            sortMode,
            acquisitionOrder,
            scope,
        })

    const handlePress = useCallback(
        (item: AccountCollectibleLiteRow) => {
            navigation.navigate('CollectibleDetails', {
                assetId: item.assetId,
                chainId: item.scope.chainId,
            })
        },
        [navigation],
    )

    const viewRequestKey = galleryViewRequestKey({
        addresses: sources.map(source => source.address),
        selectedChainId,
        sortMode,
        search: debouncedSearchFilter,
        showOptedIn,
        showSuspicious,
        showHidden,
        acquisitionOrderSize: acquisitionOrder.size,
    })
    const flatListRef = useGalleryScrollReset({
        viewRequestKey,
        hasRowsForRequest: collectibles.length > 0 && !isPlaceholderData,
        galleryLayout,
    })

    const isNetworkEmpty =
        selectedChainId !== null && !debouncedSearchFilter.length
    const { failedChainNames, isLoadFailed, handleRetry, isRetrying } =
        useNftRefreshFailure({
            sources,
            unrefreshedChainIds,
            selectedChainId,
            networkRowCount,
            isSearching: debouncedSearchFilter.length > 0,
        })
    const { title: listEmptyTitle, body: listEmptyBody } = nftListEmptyCopy({
        t,
        loadFailedChainNames: isLoadFailed ? failedChainNames : undefined,
        isUserHidden,
        isSuspiciousHidden,
        isNetworkEmpty,
        selectedChainId,
    })

    return {
        collectibles,
        collectibleCount: collectibles.length,
        isPending,
        isRefreshing,
        hasAccount: account !== null,
        canOptIn,
        isMultiChain,
        unsupportedNetworkNames,
        showEmptyState:
            !isPending &&
            rows.length === 0 &&
            !searchFilter.length &&
            unrefreshedChainIds.size === 0,
        refreshNoticeChainNames: isLoadFailed ? undefined : failedChainNames,
        isLoadFailed,
        handleRetry,
        isRetrying,
        shouldShowNetwork: isMultiChain && selectedChainId === null,
        listEmptyTitle,
        listEmptyBody,
        chainFilterOptions,
        selectedChainId,
        setSelectedChainId,
        galleryLayout,
        searchFilter,
        debouncedSearchFilter,
        sortMode,
        showOptedIn,
        showWatchAccounts,
        setSearchFilter,
        setGalleryLayout,
        setSortMode,
        setShowOptedIn,
        setShowWatchAccounts,
        handlePress,
        handleRefresh,
        openManageSheet,
        openAddNftSheet,
        flatListRef,
    }
}
