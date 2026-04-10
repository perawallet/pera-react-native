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
    PWIcon,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type ManageAssetsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onOpenSort: () => void
    onOpenFilter: () => void
    onRemoveAssets: () => void
    isWatchAccount: boolean
}

export const ManageAssetsBottomSheet = ({
    isVisible,
    onClose,
    onOpenSort,
    onOpenFilter,
    onRemoveAssets,
    isWatchAccount,
}: ManageAssetsBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

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
                center={
                    <PWText variant='h4'>{t('manage_assets.title')}</PWText>
                }
                paddingStyle='dense'
            />
            <PWView style={styles.container}>
                <PWTouchableOpacity
                    style={styles.menuRow}
                    onPress={onOpenSort}
                    testID='manage_assets_sort'
                >
                    <PWIcon
                        name='list-arrow-down'
                        variant='primary'
                        size='sm'
                    />
                    <PWText style={styles.menuLabel}>
                        {t('manage_assets.sort')}
                    </PWText>
                </PWTouchableOpacity>

                <PWTouchableOpacity
                    style={styles.menuRow}
                    onPress={onOpenFilter}
                    testID='manage_assets_filter'
                >
                    <PWIcon
                        name='funnel'
                        variant='primary'
                        size='sm'
                    />
                    <PWText style={styles.menuLabel}>
                        {t('manage_assets.filter')}
                    </PWText>
                </PWTouchableOpacity>

                {!isWatchAccount && (
                    <PWTouchableOpacity
                        style={styles.menuRow}
                        onPress={onRemoveAssets}
                        testID='manage_assets_remove'
                    >
                        <PWIcon
                            name='trash'
                            variant='error'
                            size='sm'
                        />
                        <PWText style={styles.menuLabelDestructive}>
                            {t('manage_assets.remove_assets')}
                        </PWText>
                    </PWTouchableOpacity>
                )}
            </PWView>
        </PWBottomSheet>
    )
}
