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
import { PWButton, PWRadioButton, PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useNftSortContent } from './useNftSortContent'

export type NftSortContentProps = Record<string, never>

export const NftSortContent = (_: NftSortContentProps = {}) => {
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const { sortMode, handleSortModeChange, commitChanges } =
        useNftSortContent()

    const handleDone = useCallback(() => {
        commitChanges()
        dismiss()
    }, [commitChanges, dismiss])

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('account_details.nfts.sort')}
                    rightAction={
                        <PWButton
                            variant='linkPositive'
                            title={t('common.apply')}
                            onPress={handleDone}
                            paddingStyle='none'
                        />
                    }
                />
            }
        >
            <PWRadioButton
                title={t('account_details.nfts.sort_newest_first')}
                isSelected={sortMode === 'newestFirst'}
                onPress={() => handleSortModeChange('newestFirst')}
            />
            <PWRadioButton
                title={t('account_details.nfts.sort_oldest_first')}
                isSelected={sortMode === 'oldestFirst'}
                onPress={() => handleSortModeChange('oldestFirst')}
            />
            <PWRadioButton
                title={t('account_details.nfts.sort_recently_added')}
                isSelected={sortMode === 'recentlyAdded'}
                onPress={() => handleSortModeChange('recentlyAdded')}
            />
            <PWRadioButton
                title={t('account_details.nfts.sort_title_asc')}
                isSelected={sortMode === 'titleAsc'}
                onPress={() => handleSortModeChange('titleAsc')}
            />
            <PWRadioButton
                title={t('account_details.nfts.sort_title_desc')}
                isSelected={sortMode === 'titleDesc'}
                onPress={() => handleSortModeChange('titleDesc')}
            />
        </PWSheetLayout>
    )
}
