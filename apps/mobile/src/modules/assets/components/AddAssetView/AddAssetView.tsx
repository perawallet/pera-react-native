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
import { PWIcon, PWText, PWView } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import { AssetSelectionList } from '@modules/assets/components'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import { useAddAssetView } from './useAddAssetView'
import { useStyles } from './styles'

type AddAssetScreenProps = {
    variant?: AddAssetContentVariant
}

// AssetSearchItem draws its own full-width separator; render no list divider.
const NoSeparator = () => null

export const AddAssetView = ({ variant = 'asset' }: AddAssetScreenProps) => {
    const styles = useStyles()
    const isCollectible = variant === 'collectible'
    const {
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isError,
        isOffline,
        isUnavailable,
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

    const collectibleNote = isCollectible ? (
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
    ) : undefined

    return (
        <PWView style={styles.container}>
            <AssetSelectionList
                data={results}
                renderItem={renderItem}
                keyExtractor={item => item.assetId}
                searchValue={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder={
                    isCollectible
                        ? t('add_asset.collectible_search_placeholder')
                        : t('add_asset.search_placeholder')
                }
                autoFocusSearch
                isLoading={isLoading}
                skeletonCount={5}
                onEndReached={handleEndReached}
                isFetchingNextPage={isFetchingNextPage}
                ListHeaderComponent={collectibleNote}
                ItemSeparatorComponent={NoSeparator}
                ListEmptyComponent={
                    // No retry affordance: the search re-runs on the next
                    // keystroke, and reconnecting refetches on its own.
                    <OfflineTolerantView
                        isOffline={isOffline}
                        isError={isError}
                        isUnavailable={isUnavailable}
                    >
                        <EmptyView
                            title={t('add_asset.no_results')}
                            body=''
                            icon='magnifying-glass'
                        />
                    </OfflineTolerantView>
                }
            />
        </PWView>
    )
}
