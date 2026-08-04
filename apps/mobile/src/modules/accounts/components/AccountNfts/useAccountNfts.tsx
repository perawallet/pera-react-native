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

import { useCallback, useRef, useEffect, useMemo, useState } from 'react'
import { type ParamListBase, useNavigation } from '@react-navigation/native'
import { type NativeStackNavigationProp } from '@react-navigation/native-stack'
import { type PWFlatList } from '@components/core'
import {
    useSelectedAccount,
    useAccountBalancesQuery,
    useCanSignWith,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetsQuery,
    isCollectible,
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
    type GalleryLayout,
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { type CollectibleDisplayItem } from '@modules/assets/types/collectible'
import { SEARCH_DEBOUNCE_TIME_SHORT } from '@constants/ui'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddAssetContent } from '@modules/assets/components/AddAssetContent'
import { NftFilterContent } from '../NftFilterContent'
import { NftSortContent } from '../NftSortContent'
import { ManageNftsContent, type ManageNftsAction } from '../ManageNftsContent'

type UseAccountNftsResult = {
    collectibles: CollectibleDisplayItem[]
    collectibleCount: number
    isPending: boolean
    isRefreshing: boolean
    hasAccount: boolean
    canOptIn: boolean
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
    handlePress: (item: CollectibleDisplayItem) => void
    handleRefresh: () => void
    openManageSheet: () => Promise<void>
    openAddNftSheet: () => void
    flatListRef: React.MutableRefObject<React.ComponentRef<
        typeof PWFlatList
    > | null>
}

const getCollectibleName = (item: CollectibleDisplayItem): string =>
    (item.collectible?.title ?? item.asset.name ?? '').toLowerCase()

const sortCollectibles = (
    items: CollectibleDisplayItem[],
    mode: CollectibleSortMode,
): CollectibleDisplayItem[] => {
    const sorted = [...items]

    switch (mode) {
        case 'titleAsc': {
            sorted.sort((a, b) =>
                getCollectibleName(a).localeCompare(getCollectibleName(b)),
            )
            break
        }
        case 'titleDesc': {
            sorted.sort((a, b) =>
                getCollectibleName(b).localeCompare(getCollectibleName(a)),
            )
            break
        }
        case 'newestFirst': {
            sorted.sort((a, b) => {
                const aId = BigInt(a.assetId)
                const bId = BigInt(b.assetId)
                if (aId === bId) return 0
                return aId < bId ? 1 : -1
            })
            break
        }
        case 'oldestFirst': {
            sorted.sort((a, b) => {
                const aId = BigInt(a.assetId)
                const bId = BigInt(b.assetId)
                if (aId === bId) return 0
                return aId < bId ? -1 : 1
            })
            break
        }
    }

    return sorted
}

export const useAccountNfts = (): UseAccountNftsResult => {
    const account = useSelectedAccount()
    const canOptIn = useCanSignWith(account)
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
    const { request: requestBottomSheet } = useBottomSheet()

    const openAddNftSheet = useCallback(() => {
        void requestBottomSheet<void>({
            contents: <AddAssetContent variant='collectible' />,
            options: {
                size: 'modal',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openFilterSheet = useCallback(() => {
        void requestBottomSheet<void>({
            contents: <NftFilterContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openSortSheet = useCallback(() => {
        void requestBottomSheet<void>({
            contents: <NftSortContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [requestBottomSheet])

    const openManageSheet = useCallback(async () => {
        const action = await requestBottomSheet<ManageNftsAction>({
            contents: <ManageNftsContent />,
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
        if (action === 'sort') {
            openSortSheet()
        } else if (action === 'filter') {
            openFilterSheet()
        }
    }, [requestBottomSheet, openSortSheet, openFilterSheet])

    const { accountBalances, isPending } = useAccountBalancesQuery(
        account ? [account] : [],
    )

    const refreshAddresses = useMemo(
        () => (account?.address ? [account.address] : []),
        [account?.address],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
    })

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

    const debouncedSearchFilter = useDebouncedValue(
        searchFilter,
        SEARCH_DEBOUNCE_TIME_SHORT,
    )

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

    const flatListRef = useRef<React.ComponentRef<typeof PWFlatList>>(null)
    const previousFirstItemIdRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        const currentFirstItemId = collectibles[0]?.assetId
        if (
            flatListRef.current &&
            previousFirstItemIdRef.current !== undefined &&
            previousFirstItemIdRef.current !== currentFirstItemId
        ) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false })
        }
        previousFirstItemIdRef.current = currentFirstItemId
    }, [collectibles])

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false })
        }
    }, [galleryLayout])

    useEffect(() => {
        if (flatListRef.current && debouncedSearchFilter) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false })
        }
    }, [debouncedSearchFilter])

    return {
        collectibles,
        collectibleCount: collectibles.length,
        isPending,
        isRefreshing,
        hasAccount: account !== null,
        canOptIn,
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
