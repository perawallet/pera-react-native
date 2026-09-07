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

import React, { useCallback, useMemo } from 'react'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWRefreshControl,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountNfts } from './useAccountNfts'
import {
    CollectibleGridItem,
    CollectibleListItem,
} from '@modules/assets/components'
import { NftEmptyState } from '../NftEmptyState'
import { GallerySkeleton } from './GallerySkeleton'
import { EmptyView } from '@components/EmptyView'
import {
    assetFromHoldingLiteRow,
    type AccountCollectibleLiteRow,
} from '@perawallet/wallet-core-accounts'

const GRID_COLUMNS = 2

const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.listSeparator} />
}

const keyExtractor = (item: AccountCollectibleLiteRow) => item.assetId

type GalleryCellProps = {
    item: AccountCollectibleLiteRow
    index: number
    isGrid: boolean
    onPress: (item: AccountCollectibleLiteRow) => void
}

const GalleryCellView = ({
    item,
    index,
    isGrid,
    onPress,
}: GalleryCellProps) => {
    const styles = useStyles()
    // The row components are memoised, so they need a press handler whose
    // identity survives a parent re-render. Building the closure here — inside
    // a cell that only re-renders when its own item changes — is what makes
    // that memo actually skip work.
    const handlePress = useCallback(() => onPress(item), [onPress, item])

    // Metadata is parsed here rather than in the query so a 15k-collectible
    // account only pays for the cells on screen.
    const displayItem = useMemo(() => {
        const asset = assetFromHoldingLiteRow(item)
        if (!asset) return null
        return {
            assetId: item.assetId,
            asset,
            collectible: asset.peraMetadata?.collectible,
            amount: item.amount,
        }
    }, [item])

    if (!displayItem) return null

    if (!isGrid) {
        return (
            <CollectibleListItem
                item={displayItem}
                onPress={handlePress}
            />
        )
    }

    return (
        <PWView
            style={[
                styles.gridColumn,
                index % GRID_COLUMNS === 0
                    ? styles.gridColumnLeft
                    : styles.gridColumnRight,
            ]}
        >
            <CollectibleGridItem
                item={displayItem}
                onPress={handlePress}
            />
        </PWView>
    )
}

const GalleryCell = React.memo(GalleryCellView)

export const AccountNfts = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        collectibles,
        collectibleCount,
        isPending,
        isRefreshing,
        hasAccount,
        canOptIn,
        galleryLayout,
        searchFilter,
        setSearchFilter,
        setGalleryLayout,
        handlePress,
        handleRefresh,
        openManageSheet,
        openAddNftSheet,
        flatListRef,
    } = useAccountNfts()

    const isGrid = galleryLayout === 'grid'

    const renderItem = useCallback(
        ({
            item,
            index,
        }: {
            item: AccountCollectibleLiteRow
            index: number
        }) => (
            <GalleryCell
                item={item}
                index={index}
                isGrid={isGrid}
                onPress={handlePress}
            />
        ),
        [isGrid, handlePress],
    )

    if (!hasAccount) {
        return null
    }

    const showEmptyState =
        !isPending && collectibles.length === 0 && !searchFilter.length

    return (
        <PWView style={styles.container}>
            {showEmptyState ? (
                <NftEmptyState
                    onOptInPress={canOptIn ? openAddNftSheet : undefined}
                />
            ) : (
                <>
                    <PWView style={styles.headerContainer}>
                        <PWView style={styles.titleBar}>
                            <PWView style={styles.titleBarTitleContainer}>
                                <PWText
                                    variant='body'
                                    truncate
                                >
                                    {t('account_details.nfts.count', {
                                        count: collectibleCount,
                                    })}
                                </PWText>
                            </PWView>
                            <PWView style={styles.titleBarActions}>
                                <PWTouchableOpacity
                                    style={styles.manageButton}
                                    onPress={() => void openManageSheet()}
                                >
                                    <PWIcon
                                        name='sliders'
                                        size='sm'
                                        variant='positive'
                                    />
                                    <PWText style={styles.manageText}>
                                        {t('account_details.nfts.manage')}
                                    </PWText>
                                </PWTouchableOpacity>
                                {canOptIn && (
                                    <PWButton
                                        icon='plus'
                                        variant='helper'
                                        paddingStyle='dense'
                                        onPress={openAddNftSheet}
                                    />
                                )}
                            </PWView>
                        </PWView>
                        <PWView style={styles.searchRow}>
                            <PWView style={styles.searchInputContainer}>
                                <SearchInput
                                    value={searchFilter}
                                    placeholder={t(
                                        'account_details.nfts.search_placeholder',
                                    )}
                                    onChangeText={setSearchFilter}
                                />
                            </PWView>
                            <PWView style={styles.layoutToggle}>
                                <PWTouchableOpacity
                                    style={[
                                        styles.layoutToggleButton,
                                        styles.layoutToggleButtonLeft,
                                        isGrid &&
                                            styles.layoutToggleButtonActive,
                                    ]}
                                    onPress={() => setGalleryLayout('grid')}
                                >
                                    <PWIcon
                                        name='grid-view'
                                        size='sm'
                                    />
                                </PWTouchableOpacity>
                                <PWTouchableOpacity
                                    style={[
                                        styles.layoutToggleButton,
                                        styles.layoutToggleButtonRight,
                                        !isGrid &&
                                            styles.layoutToggleButtonActive,
                                    ]}
                                    onPress={() => setGalleryLayout('list')}
                                >
                                    <PWIcon
                                        name='list-view'
                                        size='sm'
                                    />
                                </PWTouchableOpacity>
                            </PWView>
                        </PWView>
                    </PWView>
                    <PWFlatList
                        pauseSyncOnInteraction
                        ref={flatListRef}
                        // Keyed on the layout ONLY. Sorting and searching just
                        // reorder/narrow `data`, which FlashList handles, so
                        // keying on them threw the whole list and its recycle
                        // pool away on every debounced keystroke — the cost
                        // this fixes. The layout toggle is different: it flips
                        // numColumns between 2 and 1, which FlashList cannot do
                        // in place, and without the remount rows keep the other
                        // layout's measured heights and render large gaps.
                        key={galleryLayout}
                        // FlashList v2 anchors the viewport on whichever row was
                        // first visible and re-applies that anchor on every data
                        // change. A re-sort keeps every row and moves all of
                        // them, so the anchor dragged the user to wherever their
                        // old top row now lived — the bottom, going A-Z → Z-A.
                        // The gallery never prepends, so anchoring
                        // has nothing here to protect.
                        maintainVisibleContentPosition={{ disabled: true }}
                        data={collectibles}
                        renderItem={renderItem}
                        ItemSeparatorComponent={isGrid ? null : ListSeparator}
                        numColumns={isGrid ? GRID_COLUMNS : 1}
                        keyExtractor={keyExtractor}
                        automaticallyAdjustKeyboardInsets
                        contentContainerStyle={styles.contentContainer}
                        refreshControl={
                            <PWRefreshControl
                                isRefreshing={isRefreshing}
                                onRefresh={handleRefresh}
                            />
                        }
                        ListEmptyComponent={
                            <EmptyView
                                title={t('account_details.nfts.nomatch_title')}
                                body={t('account_details.nfts.nomatch_body')}
                                loadingView={
                                    <GallerySkeleton isGrid={isGrid} />
                                }
                                isLoading={isPending}
                            />
                        }
                    />
                </>
            )}
        </PWView>
    )
}
