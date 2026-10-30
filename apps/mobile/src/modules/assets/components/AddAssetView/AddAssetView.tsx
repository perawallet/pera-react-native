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
import { ChainNotice } from '@components/ChainNotice'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { OfflineTolerantView } from '@components/OfflineTolerantView'
import { AssetSearchItem } from '@modules/assets/components/AssetSearchItem'
import { AssetSelectionList } from '@modules/assets/components'
import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import { resultKey, useAddAssetView } from './useAddAssetView'
import { useStyles } from './styles'

type AddAssetScreenProps = {
    variant?: AddAssetContentVariant
    chainId: Nullable<ChainId>
}

export const AddAssetView = ({
    variant = 'asset',
    chainId,
}: AddAssetScreenProps) => {
    const styles = useStyles()
    const isCollectible = variant === 'collectible'
    const {
        chainOptions,
        selectedChainId,
        handleSelectChain,
        searchQuery,
        handleSearchChange,
        searchPlaceholder,
        results,
        showsNetwork,
        isLoading,
        isError,
        isOffline,
        isIntegrityBlocked,
        isUnavailable,
        unavailableTitle,
        unavailableBody,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        isIncomplete,
        isOptedIn,
        isOptingIn,
        canAdd,
        handleRequestAdd,
        canRemove,
        handleRequestRemove,
        t,
    } = useAddAssetView({ variant, chainId })

    const renderItem = useCallback(
        ({ item }: { item: ScopedAssetSearchResult }) => (
            <AssetSearchItem
                result={item}
                isOptedIn={isOptedIn(item)}
                isOptingIn={isOptingIn(item)}
                onAdd={canAdd(item) ? handleRequestAdd : undefined}
                onRemove={canRemove(item) ? handleRequestRemove : undefined}
                showsNetwork={showsNetwork}
            />
        ),
        [
            isOptedIn,
            isOptingIn,
            canAdd,
            handleRequestAdd,
            canRemove,
            handleRequestRemove,
            showsNetwork,
        ],
    )

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage()
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

    const incompleteNotice = isIncomplete ? (
        <ChainNotice
            kind='warning'
            titleKey='add_asset.partial_results'
            style={styles.incompleteNotice}
            testID='add_asset_partial_results'
        />
    ) : undefined

    const chainFilter =
        chainOptions.length > 0 ? (
            <FilterSelection
                options={chainOptions}
                selectedValue={selectedChainId}
                onSelect={handleSelectChain}
                testID='add_asset_network_filter'
            />
        ) : undefined

    return (
        <PWView style={styles.container}>
            <AssetSelectionList
                data={results}
                renderItem={renderItem}
                keyExtractor={resultKey}
                searchValue={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder={searchPlaceholder}
                autoFocusSearch
                searchAccessory={chainFilter}
                isLoading={isLoading}
                skeletonCount={5}
                onEndReached={handleEndReached}
                isFetchingNextPage={isFetchingNextPage}
                ListHeaderComponent={collectibleNote ?? incompleteNotice}
                // AssetSearchItem draws its own full-width separator; render no list divider.
                ItemSeparatorComponent={null}
                ListEmptyComponent={
                    // No retry affordance: the search re-runs on the next
                    // keystroke, and reconnecting refetches on its own.
                    <OfflineTolerantView
                        isOffline={isOffline}
                        isIntegrityBlocked={isIntegrityBlocked}
                        isError={isError}
                        isUnavailable={isUnavailable}
                        unavailableTitle={unavailableTitle}
                        unavailableBody={unavailableBody}
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
