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
    useAccountCollectiblesQuery,
    useAccountOptInRoundsQuery,
    useCanSignWith,
    type AccountCollectibleLiteRow,
} from '@perawallet/wallet-core-accounts'
import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
    type GalleryLayout,
} from '@perawallet/wallet-core-assets'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import { SEARCH_DEBOUNCE_TIME_SHORT } from '@constants/ui'
import { useSyncRefresh } from '@hooks/useSyncRefresh'
import { useBottomSheet } from '@modules/bottom-sheet'
import { AddAssetContent } from '@modules/assets/components/AddAssetContent'
import { NftFilterContent } from '../NftFilterContent'
import { NftSortContent } from '../NftSortContent'
import { ManageNftsContent, type ManageNftsAction } from '../ManageNftsContent'

type UseAccountNftsResult = {
    collectibles: AccountCollectibleLiteRow[]
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
    handlePress: (item: AccountCollectibleLiteRow) => void
    handleRefresh: () => void
    openManageSheet: () => Promise<void>
    openAddNftSheet: () => void
    flatListRef: React.MutableRefObject<React.ComponentRef<
        typeof PWFlatList
    > | null>
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

    const { optInRounds } = useAccountOptInRoundsQuery(
        account?.address,
        sortMode === 'recentlyAdded',
    )

    const refreshAddresses = useMemo(
        () => (account?.address ? [account.address] : []),
        [account?.address],
    )
    const { isRefreshing, refresh: handleRefresh } = useSyncRefresh({
        addresses: refreshAddresses,
    })

    useEffect(() => {
        setSearchFilter('')
    }, [account?.address])

    const debouncedSearchFilter = useDebouncedValue(
        searchFilter,
        SEARCH_DEBOUNCE_TIME_SHORT,
    )

    // Opt-in round lives in a separate indexer-backed query, so that one order
    // can't be expressed in SQL. Everything else — the collectible filter, the
    // search, the sort — runs in the engine, and rows come back unparsed.
    const sqlSortMode = sortMode === 'recentlyAdded' ? undefined : sortMode

    const { collectibles: rows, isPending } = useAccountCollectiblesQuery(
        account?.address,
        {
            sortMode: sqlSortMode,
            search: debouncedSearchFilter || undefined,
            includeOptedInOnly: showOptedIn,
        },
    )

    const collectibles = useMemo(() => {
        if (sortMode !== 'recentlyAdded') return rows

        // Roundless items (rounds still loading, or missing from the indexer
        // page) sink below rounded ones. `sort` is stable, so ties keep SQL's
        // asset-id-descending order — the same newest-created fallback the
        // pre-load ordering used.
        return [...rows].sort((a, b) => {
            const aRound = optInRounds.get(a.assetId)
            const bRound = optInRounds.get(b.assetId)
            if (aRound === bRound) return 0
            if (aRound === undefined) return 1
            if (bRound === undefined) return -1
            return bRound - aRound
        })
    }, [rows, sortMode, optInRounds])

    const handlePress = useCallback(
        (item: AccountCollectibleLiteRow) => {
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
