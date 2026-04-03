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
import { PWButton, PWFlatList, PWText, PWView } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useAccountNfts } from './useAccountNfts'
import { CollectibleGridItem } from './CollectibleGridItem'
import { CollectibleListItem } from './CollectibleListItem'
import type { CollectibleDisplayItem } from './types'
import { LoadingView } from '@components/LoadingView'

const GRID_COLUMNS = 2
const SKELETON_COUNT = 6

export const AccountNfts = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        collectibles,
        isPending,
        hasAccount,
        galleryLayout,
        searchFilter,
        setSearchFilter,
        toggleGalleryLayout,
        handlePress,
    } = useAccountNfts()

    const isGrid = galleryLayout === 'grid'

    const renderGridItem = useCallback(
        ({ item }: { item: CollectibleDisplayItem }) => (
            <CollectibleGridItem
                asset={item.asset}
                collectible={item.collectible}
                amount={item.amount}
                isPure={item.isPure}
                onPress={() => handlePress(item)}
            />
        ),
        [handlePress],
    )

    const renderListItem = useCallback(
        ({ item }: { item: CollectibleDisplayItem }) => (
            <CollectibleListItem
                asset={item.asset}
                collectible={item.collectible}
                amount={item.amount}
                isPure={item.isPure}
                onPress={() => handlePress(item)}
            />
        ),
        [handlePress],
    )

    const renderLoadingSkeleton = () => {
        return (
            <LoadingView
                variant='skeleton'
                count={SKELETON_COUNT}
            />
        )
    }

    const getEmptyTitle = () => {
        if (searchFilter.length) {
            return t('account_details.nfts.nomatch_title')
        }
        return t('account_details.nfts.empty_title')
    }

    const getEmptyBody = () => {
        if (searchFilter.length) {
            return t('account_details.nfts.nomatch_body')
        }
        return t('account_details.nfts.empty_body')
    }

    if (!hasAccount) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <PWFlatList
                key={galleryLayout}
                data={collectibles}
                renderItem={isGrid ? renderGridItem : renderListItem}
                numColumns={isGrid ? GRID_COLUMNS : 1}
                keyExtractor={item => item.assetId}
                estimatedItemSize={isGrid ? 200 : 72}
                contentContainerStyle={styles.contentContainer}
                ListHeaderComponent={
                    <PWView style={styles.headerContainer}>
                        <PWView style={styles.titleBar}>
                            <PWText variant='h4'>
                                {t('account_details.nfts.title')}
                            </PWText>
                            <PWView style={styles.titleBarActions}>
                                <PWButton
                                    icon={
                                        isGrid
                                            ? 'horizontal-line-stack'
                                            : 'card-stack'
                                    }
                                    variant='helper'
                                    paddingStyle='dense'
                                    onPress={toggleGalleryLayout}
                                />
                            </PWView>
                        </PWView>
                        <SearchInput
                            placeholder={t(
                                'account_details.nfts.search_placeholder',
                            )}
                            onChangeText={setSearchFilter}
                        />
                    </PWView>
                }
                ListEmptyComponent={
                    isPending ? null : (
                        <EmptyView
                            title={getEmptyTitle()}
                            body={getEmptyBody()}
                        />
                    )
                }
                ListFooterComponent={
                    isPending ? (
                        renderLoadingSkeleton()
                    ) : (
                        <PWView style={styles.footer} />
                    )
                }
            />
        </PWView>
    )
}
