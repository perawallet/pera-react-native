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
import type { SharedValue } from 'react-native-reanimated'
import {
    PWButton,
    PWFlatList,
    PWIcon,
    PWRefreshControl,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { FilterSelection } from '@components/FilterSelection'
import { InfoCallout } from '@components/InfoCallout'
import { SearchInput } from '@components/SearchInput'
import { useImageMemoryReleaseOnHide } from '@hooks/useImageMemoryReleaseOnHide'
import { useLanguage } from '@hooks/useLanguage'
import { CollectibleImageVisibilityContext } from '@modules/assets'
import { useStyles } from './styles'
import { useAccountNfts } from './useAccountNfts'
import { useIsPageOnScreen } from '../../hooks/useIsPageOnScreen'
import { NftEmptyState } from '../NftEmptyState'
import { GallerySkeleton } from './GallerySkeleton'
import { EmptyView } from '@components/EmptyView'
import { type AccountCollectibleLiteRow } from '@perawallet/wallet-core-accounts'
import { GRID_COLUMNS } from './constants'
import { ListSeparator } from './ListSeparator'
import { GalleryCell } from './GalleryCell'

const keyExtractor = (item: AccountCollectibleLiteRow) =>
    `${item.scope.chainId}:${item.assetId}`

export type AccountNftsProps = {
    /** The account pager's offset, in pages. */
    offset: SharedValue<number>
    pageIndex: number
}

export const AccountNfts = ({ offset, pageIndex }: AccountNftsProps) => {
    // Read here, not in the pager, so a swipe re-renders only this page.
    const isOnScreen = useIsPageOnScreen(offset, pageIndex)
    useImageMemoryReleaseOnHide(isOnScreen)
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        collectibles,
        collectibleCount,
        isPending,
        isRefreshing,
        hasAccount,
        canOptIn,
        unsupportedNetworkNames,
        isMultiChain,
        showEmptyState,
        refreshNoticeChainNames,
        isLoadFailed,
        handleRetry,
        isRetrying,
        shouldShowNetwork,
        listEmptyTitle,
        listEmptyBody,
        chainFilterOptions,
        selectedChainId,
        setSelectedChainId,
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
    const lastRowStart =
        collectibles.length -
        (collectibles.length % GRID_COLUMNS || GRID_COLUMNS)

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
                isLastRow={index >= lastRowStart}
                shouldShowNetwork={shouldShowNetwork}
                onPress={handlePress}
            />
        ),
        [isGrid, lastRowStart, shouldShowNetwork, handlePress],
    )

    if (!hasAccount) {
        return null
    }

    return (
        // Mounted thumbnails keep their decoded bitmaps, so off screen they
        // unmount while the rows, scroll and search stay as they were.
        <CollectibleImageVisibilityContext.Provider value={isOnScreen}>
            <PWView style={styles.container}>
                {showEmptyState ? (
                    <NftEmptyState
                        isMultiChain={isMultiChain}
                        unsupportedNetworkNames={unsupportedNetworkNames}
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
                            {chainFilterOptions.length > 0 && (
                                <FilterSelection
                                    options={chainFilterOptions}
                                    selectedValue={selectedChainId}
                                    onSelect={setSelectedChainId}
                                    contentContainerStyle={styles.chainFilter}
                                    testID='nft_network_filter'
                                />
                            )}
                        </PWView>
                        {refreshNoticeChainNames !== undefined && (
                            <InfoCallout
                                title={t(
                                    'account_details.nfts.refresh_error_title',
                                    { chains: refreshNoticeChainNames },
                                )}
                                body={t(
                                    'account_details.nfts.refresh_error_body',
                                )}
                                style={styles.refreshNotice}
                                testID='nft_refresh_error'
                            />
                        )}
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
                            ItemSeparatorComponent={
                                isGrid ? null : ListSeparator
                            }
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
                                    title={listEmptyTitle}
                                    body={listEmptyBody}
                                    loadingView={
                                        <GallerySkeleton isGrid={isGrid} />
                                    }
                                    isLoading={isPending}
                                    button={
                                        isLoadFailed ? (
                                            <PWButton
                                                variant='secondary'
                                                title={t('common.retry.label')}
                                                onPress={handleRetry}
                                                isLoading={isRetrying}
                                                testID='nft_load_retry'
                                            />
                                        ) : undefined
                                    }
                                />
                            }
                        />
                    </>
                )}
            </PWView>
        </CollectibleImageVisibilityContext.Provider>
    )
}
