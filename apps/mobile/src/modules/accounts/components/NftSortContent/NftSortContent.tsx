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
    PWButton,
    PWIcon,
    PWRadioButton,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import {
    useCollectiblePreferencesStore,
    type CollectibleSortMode,
} from '@perawallet/wallet-core-assets'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

export type NftSortContentProps = Record<string, never>

export const NftSortContent = (_: NftSortContentProps = {}) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { dismiss } = useBottomSheetResult<void>()

    const sortMode = useCollectiblePreferencesStore(
        state => state.collectibleSortMode,
    )
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )

    const handleChange = (mode: CollectibleSortMode) => {
        setSortMode(mode)
    }

    return (
        <>
            <PWToolbar
                left={
                    <PWIcon
                        name='cross'
                        onPress={dismiss}
                    />
                }
                center={
                    <PWText variant='h4'>
                        {t('account_details.nfts.sort')}
                    </PWText>
                }
                right={
                    <PWButton
                        variant='linkPositive'
                        title={t('account_details.nfts.filter_done')}
                        onPress={dismiss}
                        paddingStyle='none'
                    />
                }
                paddingStyle='dense'
                style={styles.toolbar}
            />

            <PWView style={styles.contentContainer}>
                <PWRadioButton
                    title={t('account_details.nfts.sort_newest_first')}
                    isSelected={sortMode === 'newestFirst'}
                    onPress={() => handleChange('newestFirst')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_oldest_first')}
                    isSelected={sortMode === 'oldestFirst'}
                    onPress={() => handleChange('oldestFirst')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_asc')}
                    isSelected={sortMode === 'titleAsc'}
                    onPress={() => handleChange('titleAsc')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_desc')}
                    isSelected={sortMode === 'titleDesc'}
                    onPress={() => handleChange('titleDesc')}
                />
            </PWView>
        </>
    )
}
