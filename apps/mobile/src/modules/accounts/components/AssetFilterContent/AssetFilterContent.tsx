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
import { PWButton, PWSheetLayout } from '@components/core'
import { SheetHeader, useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { FilterRow } from './FilterRow'
import { useAssetFilterContent } from './useAssetFilterContent'

export type AssetFilterContentProps = Record<string, never>

export const AssetFilterContent = (_: AssetFilterContentProps = {}) => {
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()
    const {
        hideZeroBalance,
        displayNfts,
        displayOptedInNfts,
        handleToggleHideZeroBalance,
        handleToggleDisplayNfts,
        handleToggleDisplayOptedInNfts,
        commitChanges,
    } = useAssetFilterContent()

    const handleDone = useCallback(() => {
        commitChanges()
        dismiss()
    }, [commitChanges, dismiss])

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={t('asset_filter.title')}
                    rightAction={
                        <PWButton
                            variant='linkPositive'
                            title={t('common.apply')}
                            onPress={handleDone}
                            paddingStyle='none'
                            testID='asset_filter_apply_button'
                        />
                    }
                />
            }
        >
            <FilterRow
                label={t('asset_filter.hide_zero_balance')}
                description={t('asset_filter.hide_zero_balance_description')}
                value={hideZeroBalance}
                onToggle={handleToggleHideZeroBalance}
                testID='asset_filter_hide_zero_balance'
            />
            <FilterRow
                label={t('asset_filter.display_nfts')}
                description={t('asset_filter.display_nfts_description')}
                value={displayNfts}
                onToggle={handleToggleDisplayNfts}
                testID='asset_filter_display_nfts'
            />
            <FilterRow
                label={t('asset_filter.display_opted_in_nfts')}
                description={t(
                    'asset_filter.display_opted_in_nfts_description',
                )}
                // Opted-in NFTs are a subset of NFTs, so this is gated on the NFTs toggle.
                value={displayNfts && displayOptedInNfts}
                onToggle={handleToggleDisplayOptedInNfts}
                testID='asset_filter_display_opted_in_nfts'
                disabled={!displayNfts}
            />
        </PWSheetLayout>
    )
}
