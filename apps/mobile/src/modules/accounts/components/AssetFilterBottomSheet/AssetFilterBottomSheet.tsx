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

import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { FilterRow } from './FilterRow'
import { useStyles } from './styles'
import { useAssetFilterBottomSheet } from './useAssetFilterBottomSheet'

export type AssetFilterBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const AssetFilterBottomSheet = ({
    isVisible,
    onClose,
}: AssetFilterBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        hideZeroBalance,
        displayNfts,
        displayOptedInNfts,
        handleToggleHideZeroBalance,
        handleToggleDisplayNfts,
        handleToggleDisplayOptedInNfts,
    } = useAssetFilterBottomSheet()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='auto'
        >
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={onClose}
                    />
                }
                center={<PWText variant='h4'>{t('asset_filter.title')}</PWText>}
                right={
                    <PWButton
                        variant='link'
                        title={t('asset_filter.done')}
                        onPress={onClose}
                        paddingStyle='none'
                    />
                }
                paddingStyle='dense'
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                <FilterRow
                    label={t('asset_filter.hide_zero_balance')}
                    description={t(
                        'asset_filter.hide_zero_balance_description',
                    )}
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
                    // Opted-in NFTs are a subset of NFTs, so this option is only
                    // meaningful when the parent NFTs toggle is enabled.
                    value={displayNfts && displayOptedInNfts}
                    onToggle={handleToggleDisplayOptedInNfts}
                    testID='asset_filter_display_opted_in_nfts'
                    disabled={!displayNfts}
                />
            </PWView>
        </PWBottomSheet>
    )
}
