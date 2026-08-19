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

import React, { useCallback, useRef } from 'react'
import {
    PWCheckbox,
    PWFlatList,
    PWScreen,
    PWText,
    PWTouchableOpacity,
    PWView,
    type PWFlatListRef,
} from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'
import { AccountAssetItemView } from '@modules/assets/components/AssetItem/AccountAssetItemView'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useRemoveAssetsScreen } from './useRemoveAssetsScreen'
import { useStyles } from './styles'

export const RemoveAssetsScreen = () => {
    const styles = useStyles()
    const listRef = useRef<PWFlatListRef>(null)

    const handleAfterRemove = useCallback(() => {
        // Defer the scroll so it runs after FlashList re-renders with the
        // shrunken dataset; scrolling synchronously while cells are being
        // recycled produces a jittery animation.
        requestAnimationFrame(() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true })
        })
    }, [])

    const {
        removableAssets,
        selectedAssetIds,
        isAllSelected,
        isRemoving,
        isSelectAllVisible,
        isRemoveSelectedVisible,
        handleToggleSelect,
        handleToggleSelectAll,
        handleRemoveSelected,
        t,
    } = useRemoveAssetsScreen({ onAfterRemove: handleAfterRemove })

    useNavigationHeader({
        right: isSelectAllVisible ? (
            <PWTouchableOpacity
                onPress={handleToggleSelectAll}
                testID='remove_assets_select_all_button'
            >
                <PWText>
                    {isAllSelected
                        ? t('remove_assets.deselect_all')
                        : t('remove_assets.select_all')}
                </PWText>
            </PWTouchableOpacity>
        ) : null,
    })

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => {
            const isSelected = selectedAssetIds.has(item.assetId)

            return (
                <PWTouchableOpacity
                    style={styles.itemContainer}
                    onPress={() => handleToggleSelect(item.assetId)}
                    testID={`remove_asset_row_${item.assetId}`}
                >
                    <PWView style={styles.assetInfo}>
                        <AccountAssetItemView
                            accountBalance={item}
                            iconSize='md'
                        />
                    </PWView>
                    <PWView pointerEvents='none'>
                        <PWCheckbox checked={isSelected} />
                    </PWView>
                </PWTouchableOpacity>
            )
        },
        [selectedAssetIds, handleToggleSelect, styles],
    )

    return (
        <PWScreen
            testID='remove_assets_screen'
            scroll='never'
            footer={
                isRemoveSelectedVisible ? (
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleRemoveSelected}
                        isLoading={isRemoving}
                        isDisabled={selectedAssetIds.size === 0 || isRemoving}
                        testID='remove_assets_confirm_slide'
                    />
                ) : undefined
            }
        >
            <PWFlatList
                ref={listRef}
                data={removableAssets}
                renderItem={renderItem}
                keyExtractor={item => item.assetId}
                ListEmptyComponent={
                    <EmptyView
                        title={t('remove_assets.empty_title')}
                        body={t('remove_assets.empty_body')}
                    />
                }
            />
        </PWScreen>
    )
}
