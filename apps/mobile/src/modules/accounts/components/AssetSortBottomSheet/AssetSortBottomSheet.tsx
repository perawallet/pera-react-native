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
    PWRadioButton,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { ParamListBase, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAssetSortBottomSheet } from './useAssetSortBottomSheet'
import { useStyles } from './styles'
import { useCallback } from 'react'
import { View } from 'react-native'

export type AssetSortBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const AssetSortBottomSheet = ({
    isVisible,
    onClose,
}: AssetSortBottomSheetProps) => {
    const styles = useStyles()
    const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>()
    const {
        sortOptions,
        assetSortMode,
        hideZeroBalance,
        handleSortModeChange,
        handleHideZeroBalanceToggle,
        handleDone,
        t,
    } = useAssetSortBottomSheet({ onClose })

    const handleRemoveAssets = useCallback(() => {
        onClose()
        navigation.navigate('RemoveAssets')
    }, [onClose, navigation])

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onBackdropPress={onClose}
            size='auto'
        >
            <PWView style={styles.contentContainer}>
                <PWView style={styles.headerContainer}>
                    <PWToolbar
                        left={
                            <PWIcon
                                name='cross'
                                onPress={onClose}
                            />
                        }
                        center={
                            <PWText variant='h4'>
                                {t('asset_sort.title')}
                            </PWText>
                        }
                        right={
                            <PWButton
                                variant='link'
                                paddingStyle='none'
                                title={t('asset_sort.done')}
                                onPress={handleDone}
                            />
                        }
                        paddingStyle='none'
                    />
                </PWView>
                {sortOptions.map(option => (
                    <PWRadioButton
                        key={option.mode}
                        title={t(option.labelKey)}
                        isSelected={assetSortMode === option.mode}
                        onPress={() => handleSortModeChange(option.mode)}
                        testID={`asset_sort_option_${option.mode}`}
                    />
                ))}

                <PWView style={styles.divider} />

                <PWTouchableOpacity
                    style={styles.filterRow}
                    onPress={handleHideZeroBalanceToggle}
                    testID='asset_sort_hide_zero_balance'
                >
                    <PWText style={styles.filterLabel}>
                        {t('asset_sort.hide_zero_balance')}
                    </PWText>
                    <PWCheckbox
                        checked={hideZeroBalance}
                        onPress={handleHideZeroBalanceToggle}
                        containerStyle={styles.checkboxContainer}
                    />
                </PWTouchableOpacity>

                <PWView style={styles.divider} />

                <PWView style={styles.buttonContainer}>
                    <PWButton
                        title={t('remove_assets.title')}
                        variant='destructive'
                        icon='trash'
                        onPress={handleRemoveAssets}
                        testID='asset_sort_remove_assets'
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
