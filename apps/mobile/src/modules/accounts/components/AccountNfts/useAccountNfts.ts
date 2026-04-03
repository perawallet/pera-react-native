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
    useAllAccounts,
    isSigningAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    isCollectible,
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
    type GalleryLayout,
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { type CollectibleDisplayItem } from './types'
import { useModalState } from '@hooks/useModalState'

type UseAccountNftsResult = {
    collectibles: CollectibleDisplayItem[]
    collectibleCount: number
    isPending: boolean
    hasAccount: boolean
    canOptIn: boolean
    galleryLayout: GalleryLayout
    searchFilter: string
    sortMode: CollectibleSortMode
    showOptedIn: boolean
    isManageSheetVisible: boolean
    isSortSheetVisible: boolean
    isFilterSheetVisible: boolean
    setSearchFilter: (value: string) => void
    setGalleryLayout: (layout: GalleryLayout) => void
    setSortMode: (mode: CollectibleSortMode) => void
    setShowOptedIn: (value: boolean) => void
    handlePress: (item: CollectibleDisplayItem) => void
    openManageSheet: () => void
    closeManageSheet: () => void
    openSortSheet: () => void
    closeSortSheet: () => void
    openFilterSheet: () => void
    closeFilterSheet: () => void
}

const getCollectibleName = (item: CollectibleDisplayItem): string =>
    (item.collectible?.title ?? item.asset.name ?? '').toLowerCase()

const sortCollectibles = (
    items: CollectibleDisplayItem[],
    mode: CollectibleSortMode,
): CollectibleDisplayItem[] => {
    const sorted = [...items]

    switch (mode) {
        case 'titleAsc':
            sorted.sort((a, b) =>
                getCollectibleName(a).localeCompare(getCollectibleName(b)),
            )
            break
        case 'titleDesc':
            sorted.sort((a, b) =>
                getCollectibleName(b).localeCompare(getCollectibleName(a)),
            )
            break
        case 'newestFirst':
            sorted.sort((a, b) => {
                const aId = BigInt(a.assetId)
                const bId = BigInt(b.assetId)
                if (aId === bId) return 0
                return aId < bId ? 1 : -1
            })
            break
        case 'oldestFirst':
            sorted.sort((a, b) => {
                const aId = BigInt(a.assetId)
                const bId = BigInt(b.assetId)
                if (aId === bId) return 0
                return aId < bId ? -1 : 1
            })
            break
    }

    return sorted
}

export const useAccountNfts = (): UseAccountNftsResult => {
    const account = useSelectedAccount()
    const allAccounts = useAllAccounts()
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
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )
    const setGalleryLayout = useCollectiblePreferencesStore(
        state => state.setGalleryLayout,
    )
    const setShowOptedIn = useCollectiblePreferencesStore(
        state => state.setShowOptedIn,
    )

    const manageSheetModel = useModalState()
    const sortSheetModel = useModalState()
    const filterSheetModel = useModalState()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()

    const canOptIn = useMemo(
        () => account !== null && isSigningAccount(account, allAccounts),
        [account, allAccounts],
    )

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
            const isOptedInOnly = balance.amount.isZero()

            if (isOptedInOnly && !showOptedIn) {
                continue
            }

            items.push({
                assetId: balance.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount: balance.amount,
            })
        }

        const sorted = sortCollectibles(items, sortMode)

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
    }, [balanceData, assets, debouncedSearchFilter, sortMode, showOptedIn])

    const handlePress = useCallback(
        (item: CollectibleDisplayItem) => {
            navigation.navigate('CollectibleDetails', {
                assetId: item.assetId,
            })
        },
        [navigation],
    )

    return {
        collectibles,
        collectibleCount: collectibles.length,
        isPending,
        hasAccount: account !== null,
        canOptIn,
        galleryLayout,
        searchFilter,
        sortMode,
        showOptedIn,
        isManageSheetVisible: manageSheetModel.isOpen,
        isSortSheetVisible: sortSheetModel.isOpen,
        isFilterSheetVisible: filterSheetModel.isOpen,
        setSearchFilter,
        setGalleryLayout,
        setSortMode,
        setShowOptedIn,
        handlePress,
        openManageSheet: manageSheetModel.open,
        closeManageSheet: manageSheetModel.close,
        openSortSheet: sortSheetModel.open,
        closeSortSheet: sortSheetModel.close,
        openFilterSheet: filterSheetModel.open,
        closeFilterSheet: filterSheetModel.close,
    }
}
