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
    PWCheckbox,
    PWFlatList,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { useRemoveAssetsScreen } from './useRemoveAssetsScreen'
import { useStyles } from './styles'

export const RemoveAssetsScreen = () => {
    const styles = useStyles()
    const {
        removableAssets,
        selectedAssetIds,
        isAllSelected,
        handleToggleSelect,
        handleToggleSelectAll,
        handleRemoveSelected,
        t,
    } = useRemoveAssetsScreen()

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => {
            const isSelected = selectedAssetIds.has(item.assetId)

            return (
                <PWTouchableOpacity
                    style={styles.itemContainer}
                    onPress={() => handleToggleSelect(item.assetId)}
                >
                    <PWView style={styles.assetInfo}>
                        <AccountAssetItemView
                            accountBalance={item}
                            iconSize='md'
                        />
                    </PWView>
                    <PWCheckbox
                        checked={isSelected}
                        onPress={() => handleToggleSelect(item.assetId)}
                    />
                </PWTouchableOpacity>
            )
        },
        [selectedAssetIds, handleToggleSelect, styles],
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.headerContainer}>
                <PWText variant='h4'>{t('remove_assets.title')}</PWText>
                <PWTouchableOpacity onPress={handleToggleSelectAll}>
                    <PWText>{t('remove_assets.select_all')}</PWText>
                </PWTouchableOpacity>
            </PWView>

            <PWFlatList
                data={removableAssets}
                renderItem={renderItem}
                keyExtractor={item => item.assetId}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <EmptyView
                        title={t('remove_assets.empty_title')}
                        body={t('remove_assets.empty_body')}
                    />
                }
            />

            <PWView style={styles.footerContainer}>
                <PWButton
                    title={t('remove_assets.remove_selected', {
                        count: selectedAssetIds.size,
                    })}
                    variant='destructive'
                    onPress={handleRemoveSelected}
                    isDisabled={selectedAssetIds.size === 0}
                />
            </PWView>
        </PWView>
    )
}
