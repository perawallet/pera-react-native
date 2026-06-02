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
import { ActivityIndicator } from 'react-native'
import { PWFlatList, PWIcon, PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import { useAddAssetView } from './useAddAssetView'
import { useStyles } from './styles'
import { LoadingView } from '@components/LoadingView'
import { SearchInput } from '@components/SearchInput'

type AddAssetScreenProps = {
    variant?: AddAssetContentVariant
}

export const AddAssetView = ({ variant = 'asset' }: AddAssetScreenProps) => {
    const styles = useStyles()
    const isCollectible = variant === 'collectible'
    const {
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        optedInAssetIds,
        optingInAssetIds,
        handleRequestAdd,
        t,
    } = useAddAssetView({ variant })

    const renderItem = useCallback(
        ({ item }: { item: DisplayableAsset }) => (
            <AssetSearchItem
                item={item}
                isOptedIn={optedInAssetIds.has(item.assetId)}
                isOptingIn={optingInAssetIds.has(item.assetId)}
                onAdd={handleRequestAdd}
            />
        ),
        [optedInAssetIds, optingInAssetIds, handleRequestAdd],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage?.()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    return (
        <PWView style={styles.container}>
            {isCollectible && (
                <PWView style={styles.noteContainer}>
                    <PWIcon
                        name='info'
                        size='sm'
                        variant='positive'
                        style={styles.noteIcon}
                    />
                    <PWText
                        variant='body'
                        style={styles.noteText}
                    >
                        {t('add_asset.collectible_note')}
                    </PWText>
                </PWView>
            )}
            <PWView style={styles.searchContainer}>
                <SearchInput
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    placeholder={
                        isCollectible
                            ? t('add_asset.collectible_search_placeholder')
                            : t('add_asset.search_placeholder')
                    }
                    autoCapitalize='none'
                    autoCorrect={false}
                    autoFocus
                />
            </PWView>

            {isLoading ? (
                <LoadingView
                    variant='skeleton'
                    count={5}
                    style={styles.loadingContainer}
                />
            ) : (
                <PWFlatList
                    data={results}
                    renderItem={renderItem}
                    // AssetSearchItem draws its own full-width separator.
                    ItemSeparatorComponent={null}
                    keyExtractor={item => item.assetId}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    inBottomSheet
                    ListEmptyComponent={
                        !isLoading ? (
                            <EmptyView
                                title={t('add_asset.no_results')}
                                body=''
                                icon='magnifying-glass'
                            />
                        ) : null
                    }
                    ListFooterComponent={
                        isFetchingNextPage ? (
                            <PWView style={styles.emptyContainer}>
                                <ActivityIndicator />
                            </PWView>
                        ) : null
                    }
                />
            )}
        </PWView>
    )
}
