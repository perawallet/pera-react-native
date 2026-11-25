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

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
    type GalleryLayout,
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
import { useSyncRefreshAll } from '@hooks/useSyncRefresh'
import { useAccountChainFilterOptions } from '../../hooks/useAccountChainFilterOptions'
import { useAssetListViewStore } from '../../hooks/useAssetListViewStore'
import { useNftHoldingSources } from '../../hooks/useNftHoldingSources'
import { useSelectedNetworkSource } from '../../hooks/useSelectedNetworkSource'
import { nftListEmptyCopy } from './nftListEmptyCopy'
import { useGalleryScrollReset } from './useGalleryScrollReset'
import { useNftGallerySheets } from './useNftGallerySheets'
import { useNftGalleryRows } from './useNftGalleryRows'

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
    /** The last refresh failed and the gallery is showing stored NFTs. */
    showRefreshNotice: boolean
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

    const sortMode = useCollectiblePreferencesStore(
        state => state.collectibleSortMode,
    )
    const galleryLayout = useCollectiblePreferencesStore(
        state => state.galleryLayout,
    )
    const showOptedIn = useCollectiblePreferencesStore(
        state => state.showOptedIn,
    )
    const showWatchAccounts = useCollectiblePreferencesStore(
        state => state.showWatchAccounts,
    )
    const showSuspicious = useCollectiblePreferencesStore(
        state => state.showSuspicious,
    )
    const showHidden = useCollectiblePreferencesStore(state => state.showHidden)
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )
    const setGalleryLayout = useCollectiblePreferencesStore(
        state => state.setGalleryLayout,
    )
    const setShowOptedIn = useCollectiblePreferencesStore(
        state => state.setShowOptedIn,
    )
    const setShowWatchAccounts = useCollectiblePreferencesStore(
        state => state.setShowWatchAccounts,
    )

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
    const refreshSources = useMemo(
        () =>
            sources.map(({ address, scope }) => ({
                addresses: [address],
                scope,
            })),
        [sources],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefreshAll(
        refreshSources,
        { isUserRefresh: true },
    )

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
        hasUnrefreshedHoldings,
    } = useAccountCollectiblesQuery(sources, {
        sortMode: sqlSortMode,
        search: debouncedSearchFilter || undefined,
        includeZeroBalance: showOptedIn,
    })

    const { collectibles, isUserHidden, isSuspiciousHidden } =
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

    // Reordering or narrowing the gallery has to land the user on the first row.
    // Keyed on the *request* rather than on the rows it produces: a new sort is
    // a new query key, so the rows go through a gap — empty while cold, or the
    // previous order held as placeholder data — before the reordered ones land.
    // Deriving the trigger from the rows read that gap as "nothing changed" and
    // skipped the reset exactly when it was needed, which is how sorting a
    // freshly imported account dropped the user mid-list.
    const viewRequestKey = [
        sources.map(source => source.address).join(','),
        selectedChainId ?? '',
        sortMode,
        debouncedSearchFilter,
        showOptedIn,
        showSuspicious,
        showHidden,
        // recentlyAdded is ordered by a separate query, whose order arrives
        // after the rows: the map landing is its own reorder.
        sortMode === 'recentlyAdded' ? acquisitionOrder.size : '',
    ].join('|')
    const flatListRef = useGalleryScrollReset({
        viewRequestKey,
        hasRowsForRequest: collectibles.length > 0 && !isPlaceholderData,
        galleryLayout,
    })

    const isNetworkEmpty =
        selectedChainId !== null && !debouncedSearchFilter.length
    // A failed refresh keeps the stored NFTs, so the rows are stale, not gone;
    // with none stored it must not read as "no NFTs yet". Rows are already
    // search-filtered, so a search that matches nothing is not a failed refresh.
    const isRefreshFailed =
        hasUnrefreshedHoldings &&
        rows.length === 0 &&
        !debouncedSearchFilter.length
    const { title: listEmptyTitle, body: listEmptyBody } = nftListEmptyCopy({
        t,
        isRefreshFailed,
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
            !hasUnrefreshedHoldings,
        showRefreshNotice: hasUnrefreshedHoldings && !isRefreshFailed,
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
