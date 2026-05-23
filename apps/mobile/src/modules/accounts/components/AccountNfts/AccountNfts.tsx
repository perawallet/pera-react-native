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
import { CollectibleDisplayItem } from '@modules/assets/types/collectible'

const GRID_COLUMNS = 2
const SKELETON_COUNT = 6
const COLLECTIBLE_GRID_ITEM_SIZE = 200
const COLLECTIBLE_LIST_ITEM_SIZE = 72

const renderLoadingSkeleton = () => {
    return (
        <LoadingView
            variant='skeleton'
            count={SKELETON_COUNT}
        />
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
        debouncedSearchFilter,
        setSearchFilter,
        setGalleryLayout,
        handlePress,
        openManageSheet,
        openAddNftSheet,
        flatListRef,
    } = useAccountNfts()

    const isGrid = galleryLayout === 'grid'

    const renderItem = useCallback(
        ({ item }: { item: CollectibleDisplayItem }) =>
            isGrid ? (
                <CollectibleGridItem
                    item={item}
                    onPress={() => handlePress(item)}
                />
            ) : (
                <CollectibleListItem
                    item={item}
                    onPress={() => handlePress(item)}
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
                                    onPress={openManageSheet}
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
                        key={`${galleryLayout}:${debouncedSearchFilter}`}
                        data={collectibles}
                        renderItem={renderItem}
                        numColumns={isGrid ? GRID_COLUMNS : 1}
                        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
                        keyExtractor={item => item.assetId}
                        estimatedItemSize={
                            isGrid
                                ? COLLECTIBLE_GRID_ITEM_SIZE
                                : COLLECTIBLE_LIST_ITEM_SIZE
                        }
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
