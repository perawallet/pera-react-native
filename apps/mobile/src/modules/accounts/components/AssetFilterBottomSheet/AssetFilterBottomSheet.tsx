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
    PWCheckbox,
    PWIcon,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import { useLanguage } from '@hooks/useLanguage'
import { useCallback } from 'react'
import { useStyles } from './styles'

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

    const hideZeroBalance = useAssetPreferencesStore(
        state => state.hideZeroBalance,
    )
    const setHideZeroBalance = useAssetPreferencesStore(
        state => state.setHideZeroBalance,
    )

    const handleToggle = useCallback(() => {
        setHideZeroBalance(!hideZeroBalance)
    }, [hideZeroBalance, setHideZeroBalance])

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
                    />
                }
                paddingStyle='dense'
            />

            <PWView style={styles.contentContainer}>
                <PWTouchableOpacity
                    style={styles.filterRow}
                    onPress={handleToggle}
                    testID='asset_filter_hide_zero_balance'
                >
                    <PWText style={styles.filterLabel}>
                        {t('asset_filter.hide_zero_balance')}
                    </PWText>
                    <PWCheckbox
                        checked={hideZeroBalance}
                        onPress={handleToggle}
                        containerStyle={styles.checkboxContainer}
                    />
                </PWTouchableOpacity>
            </PWView>
        </PWBottomSheet>
    )
}
