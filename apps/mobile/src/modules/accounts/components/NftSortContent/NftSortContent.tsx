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
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useCollectiblePreferencesStore } from '@perawallet/wallet-core-assets'

type NftSortContentProps = {
    onClose: () => void
}

export const NftSortContent = ({ onClose }: NftSortContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const sortMode = useCollectiblePreferencesStore(
        state => state.collectibleSortMode,
    )
    const setSortMode = useCollectiblePreferencesStore(
        state => state.setCollectibleSortMode,
    )

    return (
        <>
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
                    title={t('account_details.nfts.sort_newest_first')}
                    isSelected={sortMode === 'newestFirst'}
                    onPress={() => setSortMode('newestFirst')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_oldest_first')}
                    isSelected={sortMode === 'oldestFirst'}
                    onPress={() => setSortMode('oldestFirst')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_asc')}
                    isSelected={sortMode === 'titleAsc'}
                    onPress={() => setSortMode('titleAsc')}
                />
                <PWRadioButton
                    title={t('account_details.nfts.sort_title_desc')}
                    isSelected={sortMode === 'titleDesc'}
                    onPress={() => setSortMode('titleDesc')}
                />
            </PWView>
        </>
    )
}
