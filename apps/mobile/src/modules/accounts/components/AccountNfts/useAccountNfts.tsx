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

    const {
        collectibles: rows,
        isPending,
        isPlaceholderData,
    } = useAccountCollectiblesQuery(account?.address, {
        sortMode: sqlSortMode,
        search: debouncedSearchFilter || undefined,
        includeOptedInOnly: showOptedIn,
    })

    const collectibles = useMemo(() => {
        if (sortMode !== 'recentlyAdded') return rows

        // A row with no known round is newer than the indexer's view: holdings
        // mirror algod, so only a just-opted-in asset can be missing from the
        // (lagging) indexer map. Float those to the top so a fresh opt-in
        // lands first instantly (PERA-4845). `sort` is stable, so ties keep
        // SQL's asset-id-descending order, which also covers the map's empty
        // pre-load state.
        return [...rows].sort((a, b) => {
            const aRound = optInRounds.get(a.assetId)
            const bRound = optInRounds.get(b.assetId)
            if (aRound === bRound) return 0
            if (aRound === undefined) return -1
            if (bRound === undefined) return 1
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

    // Reordering or narrowing the gallery has to land the user on the first row.
    // Keyed on the *request* rather than on the rows it produces: a new sort is
    // a new query key, so the rows go through a gap — empty while cold, or the
    // previous order held as placeholder data — before the reordered ones land.
    // Deriving the trigger from the rows read that gap as "nothing changed" and
    // skipped the reset exactly when it was needed, which is how sorting a
    // freshly imported account dropped the user mid-list (PERA-4921).
    const viewRequestKey = [
        account?.address ?? '',
        sortMode,
        debouncedSearchFilter,
        showOptedIn,
        // recentlyAdded is ordered by a separate indexer query, whose rounds
        // arrive after the rows: the map landing is its own reorder.
        sortMode === 'recentlyAdded' ? optInRounds.size : '',
    ].join('|')
    const appliedViewRequestKeyRef = useRef(viewRequestKey)
    const hasRowsForRequest = collectibles.length > 0 && !isPlaceholderData

    useEffect(() => {
        if (appliedViewRequestKeyRef.current === viewRequestKey) return
        // Wait for this request's own rows: scrolling an empty list does
        // nothing, and FlashList re-applies its remembered offset once rows
        // arrive, undoing the reset.
        if (!hasRowsForRequest) return

        // Next frame, not this commit: FlashList settles its own offset on the
        // layout pass that follows a data change, and a scroll issued before
        // that pass loses to it (PERA-4406).
        const frame = requestAnimationFrame(() => {
            // Recorded here, not before scheduling: every placeholder gap
            // re-runs this effect, and the cleanup cancels the pending frame.
            // Marking the request applied up front turned that cancellation
            // into a reset that silently never happened, leaving the gallery
            // wherever the previous request had scrolled it (PERA-4932).
            appliedViewRequestKeyRef.current = viewRequestKey
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
        })
        return () => cancelAnimationFrame(frame)
    }, [viewRequestKey, hasRowsForRequest])

    useEffect(() => {
        if (flatListRef.current) {
            flatListRef.current.scrollToOffset({ offset: 0, animated: false })
        }
    }, [galleryLayout])

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
