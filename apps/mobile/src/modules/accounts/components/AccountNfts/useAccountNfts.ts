/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useSelectedAccount,
    useAccountBalancesQuery,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    isCollectible,
    isPureNft,
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { type CollectibleDisplayItem } from './types'

export type GalleryLayout = 'grid' | 'list'

export type CollectibleSortMode = 'titleAsc' | 'titleDesc'

type NftFilterState = {
    showOptedIn: boolean
    showWatchAccounts: boolean
}

type UseAccountNftsResult = {
    collectibles: CollectibleDisplayItem[]
    collectibleCount: number
    isPending: boolean
    hasAccount: boolean
    galleryLayout: GalleryLayout
    searchFilter: string
    sortMode: CollectibleSortMode
    filterState: NftFilterState
    isManageSheetVisible: boolean
    isSortSheetVisible: boolean
    isFilterSheetVisible: boolean
    setSearchFilter: (value: string) => void
    setGalleryLayout: (layout: GalleryLayout) => void
    setSortMode: (mode: CollectibleSortMode) => void
    toggleGalleryLayout: () => void
    handlePress: (item: CollectibleDisplayItem) => void
    openManageSheet: () => void
    closeManageSheet: () => void
    openSortSheet: () => void
    closeSortSheet: () => void
    openFilterSheet: () => void
    closeFilterSheet: () => void
    setShowOptedIn: (value: boolean) => void
    setShowWatchAccounts: (value: boolean) => void
}

export const useAccountNfts = (): UseAccountNftsResult => {
    const account = useSelectedAccount()
    const [searchFilter, setSearchFilter] = useState('')
    const [galleryLayout, setGalleryLayout] = useState<GalleryLayout>('grid')
    const [sortMode, setSortMode] = useState<CollectibleSortMode>('titleAsc')
    const [filterState, setFilterState] = useState<NftFilterState>({
        showOptedIn: true,
        showWatchAccounts: true,
    })
    const [isManageSheetVisible, setIsManageSheetVisible] = useState(false)
    const [isSortSheetVisible, setIsSortSheetVisible] = useState(false)
    const [isFilterSheetVisible, setIsFilterSheetVisible] = useState(false)
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const { accountBalances, isPending } = useAccountBalancesQuery(
        account ? [account] : [],
    )

    const balanceData = useMemo(
        () => (account ? accountBalances.get(account.address) : undefined),
        [accountBalances, account],
    )

    const assetIDs = useMemo(
        () => balanceData?.assetBalances.map(b => b.assetId) ?? [],
        [balanceData],
    )

    const { data: assets } = useAssetsQuery(assetIDs)

    useEffect(() => {
        setSearchFilter('')
    }, [account?.address])

    const debouncedSearchFilter = useDebouncedValue(searchFilter)

    const collectibles = useMemo(() => {
        if (!balanceData?.assetBalances.length || !assets) {
            return []
        }

        const items: CollectibleDisplayItem[] = []

        for (const balance of balanceData.assetBalances) {
            const asset = assets.get(balance.assetId)
            if (!asset || !isCollectible(asset)) {
                continue
            }
            items.push({
                assetId: balance.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount: balance.amount,
                isPure: isPureNft(asset),
            })
        }

        const sorted = [...items]
        sorted.sort((a, b) => {
            const nameA = (
                a.collectible?.title ??
                a.asset.name ??
                ''
            ).toLowerCase()
            const nameB = (
                b.collectible?.title ??
                b.asset.name ??
                ''
            ).toLowerCase()
            return sortMode === 'titleAsc'
                ? nameA.localeCompare(nameB)
                : nameB.localeCompare(nameA)
        })

        if (!debouncedSearchFilter) {
            return sorted
        }

        const searchTerm = debouncedSearchFilter.toLowerCase()
        return sorted.filter(item => {
            const title = item.collectible?.title?.toLowerCase() ?? ''
            const name = item.asset.name?.toLowerCase() ?? ''
            const collectionName =
                item.collectible?.collection?.name?.toLowerCase() ?? ''
            return (
                title.includes(searchTerm) ||
                name.includes(searchTerm) ||
                collectionName.includes(searchTerm)
            )
        })
    }, [balanceData, assets, debouncedSearchFilter, sortMode])

    const toggleGalleryLayout = useCallback(() => {
        setGalleryLayout(prev => (prev === 'grid' ? 'list' : 'grid'))
    }, [])

    const handlePress = useCallback(
        (item: CollectibleDisplayItem) => {
            navigation.navigate('AssetDetails', {
                assetId: item.assetId,
            })
        },
        [navigation],
    )

    const openManageSheet = useCallback(() => setIsManageSheetVisible(true), [])
    const closeManageSheet = useCallback(
        () => setIsManageSheetVisible(false),
        [],
    )
    const openSortSheet = useCallback(() => setIsSortSheetVisible(true), [])
    const closeSortSheet = useCallback(() => setIsSortSheetVisible(false), [])
    const openFilterSheet = useCallback(() => setIsFilterSheetVisible(true), [])
    const closeFilterSheet = useCallback(
        () => setIsFilterSheetVisible(false),
        [],
    )

    const setShowOptedIn = useCallback(
        (value: boolean) =>
            setFilterState(prev => ({ ...prev, showOptedIn: value })),
        [],
    )
    const setShowWatchAccounts = useCallback(
        (value: boolean) =>
            setFilterState(prev => ({ ...prev, showWatchAccounts: value })),
        [],
    )

    return {
        collectibles,
        collectibleCount: collectibles.length,
        isPending,
        hasAccount: account !== null,
        galleryLayout,
        searchFilter,
        sortMode,
        filterState,
        isManageSheetVisible,
        isSortSheetVisible,
        isFilterSheetVisible,
        setSearchFilter,
        setGalleryLayout,
        setSortMode,
        toggleGalleryLayout,
        handlePress,
        openManageSheet,
        closeManageSheet,
        openSortSheet,
        closeSortSheet,
        openFilterSheet,
        closeFilterSheet,
        setShowOptedIn,
        setShowWatchAccounts,
    }
}
