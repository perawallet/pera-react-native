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

import React, { useCallback } from 'react'
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
import { BOTTOM_SHEET_TRANSITION_DURATION } from '@constants/ui'

type ManageNftsBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    onSortPress: () => void
    onFilterPress: () => void
}

export const ManageNftsBottomSheet = ({
    isVisible,
    onClose,
    onSortPress,
    onFilterPress,
}: ManageNftsBottomSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const handleSortPress = useCallback(() => {
        onClose()
        setTimeout(onSortPress, BOTTOM_SHEET_TRANSITION_DURATION)
    }, [onClose, onSortPress])

    const handleFilterPress = useCallback(() => {
        onClose()
        setTimeout(onFilterPress, BOTTOM_SHEET_TRANSITION_DURATION)
    }, [onClose, onFilterPress])

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
                    <PWText variant='h4'>
                        {t('account_details.nfts.manage_title')}
                    </PWText>
                }
                paddingStyle='dense'
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                <PWTouchableOpacity
                    style={styles.menuRow}
                    onPress={handleSortPress}
                >
                    <PWIcon
                        name='list-arrow-down'
                        size='md'
                    />
                    <PWText style={styles.menuLabel}>
                        {t('account_details.nfts.sort')}
                    </PWText>
                </PWTouchableOpacity>

                <PWTouchableOpacity
                    style={styles.menuRow}
                    onPress={handleFilterPress}
                >
                    <PWIcon
                        name='funnel'
                        size='md'
                    />
                    <PWText style={styles.menuLabel}>
                        {t('account_details.nfts.filter')}
                    </PWText>
                </PWTouchableOpacity>
            </PWView>
        </PWBottomSheet>
    )
}
