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

import React from 'react'
import {
    PWBottomSheet,
    PWButton,
    PWIcon,
    PWRadioButton,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import type { CollectibleSortMode } from '../AccountNfts/useAccountNfts'

type NftSortBottomSheetProps = {
    isVisible: boolean
    onClose: () => void
    sortMode: CollectibleSortMode
    onSortModeChange: (mode: CollectibleSortMode) => void
}

export const NftSortBottomSheet = ({
    isVisible,
    onClose,
    sortMode,
    onSortModeChange,
}: NftSortBottomSheetProps) => {
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
                    <PWText variant='h4'>
                        {t('account_details.nfts.sort')}
                    </PWText>
                }
                right={
                    <PWButton
                        variant='link'
                        title={t('account_details.nfts.filter_done')}
                        onPress={onClose}
                        paddingStyle='none'
                    />
                }
                paddingStyle='dense'
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_asc')}
                    isSelected={sortMode === 'titleAsc'}
                    onPress={() => onSortModeChange('titleAsc')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_desc')}
                    isSelected={sortMode === 'titleDesc'}
                    onPress={() => onSortModeChange('titleDesc')}
                />
            </PWView>
        </PWBottomSheet>
    )
}
