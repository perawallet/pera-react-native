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
import { PWFlatList, PWInput, PWText, PWView } from '@components/core'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import type { AssetSearchItem as AssetSearchItemType } from '@perawallet/wallet-core-assets'
import { useAddAssetScreen } from './useAddAssetScreen'
import { useStyles } from './styles'

export const AddAssetScreen = () => {
    const styles = useStyles()
    const {
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        optedInAssetIds,
        optingInAssetId,
        handleAddAsset,
        t,
    } = useAddAssetScreen()

    const renderItem = useCallback(
        ({ item }: { item: AssetSearchItemType }) => (
            <AssetSearchItem
                item={item}
                isOptedIn={optedInAssetIds.has(item.assetId)}
                isOptingIn={optingInAssetId === item.assetId}
                onAdd={handleAddAsset}
            />
        ),
        [optedInAssetIds, optingInAssetId, handleAddAsset],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    return (
        <PWView style={styles.container}>
            <PWView style={styles.searchContainer}>
                <PWInput
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    placeholder={t('add_asset.search_placeholder')}
                    autoFocus
                />
            </PWView>

            {isLoading ? (
                <PWView style={styles.emptyContainer}>
                    <ActivityIndicator />
                </PWView>
            ) : (
                <PWFlatList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={item => item.assetId}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    keyboardDismissMode='on-drag'
                    ListEmptyComponent={
                        !isLoading ? (
                            <PWView style={styles.emptyContainer}>
                                <PWText>{t('add_asset.no_results')}</PWText>
                            </PWView>
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
