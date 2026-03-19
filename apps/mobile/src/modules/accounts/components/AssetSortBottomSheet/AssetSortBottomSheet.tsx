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
    PWRadioButton,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useAssetSortBottomSheet } from './useAssetSortBottomSheet'
import { useStyles } from './styles'

export type AssetSortBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const AssetSortBottomSheet = ({
    isVisible,
    onClose,
}: AssetSortBottomSheetProps) => {
    const styles = useStyles()
    const { sortOptions, assetSortMode, handleSortModeChange, handleDone, t } =
        useAssetSortBottomSheet({ onClose })

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
                center={<PWText variant='h4'>{t('asset_sort.title')}</PWText>}
                right={
                    <PWButton
                        variant='link'
                        title={t('asset_sort.done')}
                        onPress={handleDone}
                        paddingStyle='none'
                    />
                }
                paddingStyle='dense'
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                {sortOptions.map(option => (
                    <PWRadioButton
                        key={option.mode}
                        title={t(option.labelKey)}
                        isSelected={assetSortMode === option.mode}
                        onPress={() => handleSortModeChange(option.mode)}
                        testID={`asset_sort_option_${option.mode}`}
                    />
                ))}
            </PWView>
        </PWBottomSheet>
    )
}
