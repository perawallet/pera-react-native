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

import React from 'react'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import {
    PWButton,
    PWFlatList,
    PWListItemLayout,
    PWLoadingOverlay,
    PWRoundIcon,
    PWScreen,
    PWText,
    PWView,
} from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { ScreenHeader } from '@components/ScreenHeader'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import {
    usePeraWebImportLoadingScreen,
    type PeraWebImportReviewAccount,
} from './usePeraWebImportLoadingScreen'

export const PeraWebImportLoadingScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { reviewAccounts, isImporting, handleConfirm, handleCancel } =
        usePeraWebImportLoadingScreen()

    if (!reviewAccounts) {
        return (
            <PWScreen scroll='never'>
                <PWView style={styles.container}>
                    <PWRoundIcon
                        icon='globe'
                        size='xl'
                    />
                    <PWText
                        variant='h2'
                        style={styles.title}
                    >
                        {t('onboarding.pera_web_import.loading.title')}
                    </PWText>
                    <PWView testID='pera_web_import_loading_indicator'>
                        <LoadingView
                            variant='circle'
                            size='lg'
                        />
                    </PWView>
                </PWView>
            </PWScreen>
        )
    }

    const renderItem = ({ item }: { item: PeraWebImportReviewAccount }) => (
        <PWListItemLayout
            testID={`pera_web_import_review_item_${item.address}`}
        >
            <PWText
                variant='bodyLarge'
                weight={500}
                numberOfLines={1}
            >
                {item.name?.trim() || truncateAlgorandAddress(item.address)}
            </PWText>
            <PWText
                variant='footnoteMedium'
                weight={400}
                style={styles.address}
                numberOfLines={1}
                ellipsizeMode='middle'
            >
                {item.address}
            </PWText>
        </PWListItemLayout>
    )

    return (
        <>
            <PWScreen
                scroll='never'
                footer={
                    <PWView style={styles.footer}>
                        <PWButton
                            variant='primary'
                            title={t(
                                'onboarding.pera_web_import.review.confirm',
                            )}
                            onPress={handleConfirm}
                            isDisabled={isImporting}
                            testID='pera_web_import_review_confirm_button'
                        />
                        <PWButton
                            variant='secondary'
                            title={t('common.cancel.label')}
                            onPress={handleCancel}
                            isDisabled={isImporting}
                            testID='pera_web_import_review_cancel_button'
                        />
                    </PWView>
                }
            >
                <PWView style={styles.review}>
                    <ScreenHeader
                        title={t('onboarding.pera_web_import.review.title')}
                        description={t(
                            'onboarding.pera_web_import.review.body',
                            { count: reviewAccounts.length },
                        )}
                    />
                    <PWFlatList
                        data={reviewAccounts}
                        renderItem={renderItem}
                        keyExtractor={(item, index) =>
                            `${index}-${item.address}`
                        }
                        cardLayout
                        showsVerticalScrollIndicator={false}
                    />
                </PWView>
            </PWScreen>

            <PWLoadingOverlay
                isVisible={isImporting}
                title={t('onboarding.pera_web_import.loading.title')}
            />
        </>
    )
}
