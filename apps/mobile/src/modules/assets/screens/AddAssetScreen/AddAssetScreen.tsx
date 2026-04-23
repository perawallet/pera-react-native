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
import { Platform, ActivityIndicator, KeyboardAvoidingView } from 'react-native'
import { PWFlatList, PWIcon, PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import { OptInConfirmationBottomSheet } from '@modules/assets/components/OptInConfirmationBottomSheet'
import type { AssetSearchItem as AssetSearchItemType } from '@perawallet/wallet-core-assets'
import type { AddAssetBottomSheetVariant } from '@modules/assets/components/AddAssetBottomSheet'
import { useAddAssetScreen } from './useAddAssetScreen'
import { useStyles } from './styles'
import { LoadingView } from '@components/LoadingView'
import { SearchInput } from '@components/SearchInput'

type AddAssetScreenProps = {
    variant?: AddAssetBottomSheetVariant
}

export const AddAssetScreen = ({ variant = 'asset' }: AddAssetScreenProps) => {
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
        optingInAssetId,
        handleRequestAdd,
        handleConfirmAdd,
        handleCancelAdd,
        pendingAssetId,
        selectedAccountAddress,
        selectedAccountName,
        t,
    } = useAddAssetScreen({ variant })

    const renderItem = useCallback(
        ({ item }: { item: AssetSearchItemType }) => (
            <AssetSearchItem
                item={item}
                isOptedIn={optedInAssetIds.has(item.assetId)}
                isOptingIn={optingInAssetId === item.assetId}
                onAdd={handleRequestAdd}
            />
        ),
        [optedInAssetIds, optingInAssetId, handleRequestAdd],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage?.()
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage])

    return (
        <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                        keyExtractor={item => item.assetId}
                        onEndReached={handleEndReached}
                        onEndReachedThreshold={0.5}
                        keyboardDismissMode='on-drag'
                        contentContainerStyle={styles.listContainer}
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
            <OptInConfirmationBottomSheet
                isVisible={pendingAssetId !== null}
                onClose={handleCancelAdd}
                onConfirmOptIn={handleConfirmAdd}
                assetId={pendingAssetId}
                accountAddress={selectedAccountAddress ?? ''}
                accountName={selectedAccountName}
                isLoading={optingInAssetId !== null}
            />
        </KeyboardAvoidingView>
    )
}
