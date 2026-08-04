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

import { useCallback } from 'react'
import { PWButton, PWRadioButton, PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useAssetSortContent } from './useAssetSortContent'

export type AssetSortContentProps = Record<string, never>

export const AssetSortContent = (_: AssetSortContentProps = {}) => {
    const { dismiss } = useBottomSheetResult<void>()
    const {
        sortOptions,
        assetSortMode,
        handleSortModeChange,
        commitChanges,
        t,
    } = useAssetSortContent()

    const handleDone = useCallback(() => {
        commitChanges()
        dismiss()
    }, [commitChanges, dismiss])

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('asset_sort.title')}
                    rightAction={
                        <PWButton
                            variant='linkPositive'
                            title={t('common.apply')}
                            onPress={handleDone}
                            paddingStyle='none'
                            testID='asset_sort_apply_button'
                        />
                    }
                />
            }
        >
            {sortOptions.map(option => (
                <PWRadioButton
                    key={option.mode}
                    title={t(option.labelKey)}
                    isSelected={assetSortMode === option.mode}
                    onPress={() => handleSortModeChange(option.mode)}
                    testID={`asset_sort_option_${option.mode}`}
                />
            ))}
        </PWSheetLayout>
    )
}
