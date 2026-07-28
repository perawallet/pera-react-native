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

import React, { useCallback } from 'react'
import {
    PWButton,
    PWFlatList,
    PWIcon,
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
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { type CollectibleDisplayItem } from '@modules/assets/types/collectible'

const GRID_COLUMNS = 2
const SKELETON_COUNT = 6

const renderLoadingSkeleton = () => {
    return (
        <LoadingView
            variant='skeleton'
            count={SKELETON_COUNT}
        />
    )
}

const ListSeparator = () => {
    const styles = useStyles()

    return <PWView style={styles.listSeparator} />
}

const keyExtractor = (item: CollectibleDisplayItem) => item.assetId

type GridCellProps = {
    item: CollectibleDisplayItem
    index: number
    onPress: (item: CollectibleDisplayItem) => void
}

const GridCell = ({ item, index, onPress }: GridCellProps) => {
    const styles = useStyles()

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
                item={item}
                onPress={() => onPress(item)}
            />
        </PWView>
    )
}

export const AccountNfts = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        collectibles,
        collectibleCount,
        isPending,
        hasAccount,
        canOptIn,
        galleryLayout,
        searchFilter,
        setSearchFilter,
        setGalleryLayout,
        handlePress,
        openManageSheet,
        openAddNftSheet,
        flatListRef,
    } = useAccountNfts()

    const isGrid = galleryLayout === 'grid'

    const renderItem = useCallback(
        ({ item, index }: { item: CollectibleDisplayItem; index: number }) =>
            isGrid ? (
                <GridCell
                    item={item}
                    index={index}
                    onPress={handlePress}
                />
            ) : (
                <CollectibleListItem
                    item={item}
                    onPress={() => handlePress(item)}
                />
            ),
        [isGrid, handlePress],
    )

    const getItemType = useCallback(() => galleryLayout, [galleryLayout])

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
                        ref={flatListRef}
                        data={collectibles}
                        renderItem={renderItem}
                        // Sorting and searching only reorder/narrow `data`,
                        // which FlashList handles — keying on them threw away
                        // the whole list and its recycle pool on every toggle
                        // and every debounced keystroke. `extraData` covers the
                        // one render input outside `data` (the layout), and
                        // `getItemType` keeps the grid and list recycle pools
                        // apart so a grid cell is never reused as a list row.
                        extraData={galleryLayout}
                        getItemType={getItemType}
                        ItemSeparatorComponent={isGrid ? null : ListSeparator}
                        numColumns={isGrid ? GRID_COLUMNS : 1}
                        keyExtractor={keyExtractor}
                        automaticallyAdjustKeyboardInsets
                        contentContainerStyle={styles.contentContainer}
                        ListEmptyComponent={
                            <EmptyView
                                title={t('account_details.nfts.nomatch_title')}
                                body={t('account_details.nfts.nomatch_body')}
                                loadingView={renderLoadingSkeleton()}
                                isLoading={isPending}
                            />
                        }
                    />
                </>
            )}
        </PWView>
    )
}
