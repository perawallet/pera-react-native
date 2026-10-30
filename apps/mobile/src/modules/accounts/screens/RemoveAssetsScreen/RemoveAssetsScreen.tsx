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

import React from 'react'
import { PWFlatList, PWScreen, PWText, PWTouchableOpacity } from '@components/core'
import { ConfirmAction, CONFIRM_ACTION_LAYOUT } from '@components/ConfirmAction'
import { EmptyView } from '@components/EmptyView'
import { useNavigationHeader } from '@hooks/useNavigationHeader'
import { useRemoveAssetsScreen } from './useRemoveAssetsScreen'
import { useStyles } from './styles'

export const RemoveAssetsScreen = () => {
    const {
        removableAssets,
        selectedAssetIds,
        isAllSelected,
        isRemoving,
        isSelectAllVisible,
        isRemoveSelectedVisible,
        handleToggleSelectAll,
        handleRemoveSelected,
        t,
        listRef,
        renderItem,
    } = useRemoveAssetsScreen()

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
                        style={CONFIRM_ACTION_LAYOUT}
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
