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
import { PWButton, PWScreen, PWText, PWView } from '@components/core'
import { ConfirmAction } from '@components/ConfirmAction'
import { useLanguage } from '@hooks/useLanguage'
import { useCardAutoFundingSigningScreen } from './useCardAutoFundingSigningScreen'
import { useStyles } from './styles'

export const CardAutoFundingSigningScreen = () => {
    const { t } = useLanguage()
    const styles = useStyles()
    const { isPending, error, handleApprove, handleReject } =
        useCardAutoFundingSigningScreen()

    return (
        <PWScreen
            scroll='never'
            testID='card-auto-funding-signing'
            footer={
                <PWView style={styles.buttonContainer}>
                    <ConfirmAction
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleApprove}
                        isLoading={isPending}
                        testID='card-auto-funding-signing-confirm'
                    />
                    <PWButton
                        title={t('peraCard.auto_funding_signing.cancel_button')}
                        variant='linkNeutral'
                        onPress={handleReject}
                        isDisabled={isPending}
                        testID='card-auto-funding-signing-cancel'
                    />
                </PWView>
            }
        >
            <PWView style={styles.bodyContainer}>
                <PWText
                    variant='h1'
                    style={styles.title}
                >
                    {t('peraCard.auto_funding_signing.title')}
                </PWText>
                <PWText
                    variant='bodyLarge'
                    style={styles.body}
                >
                    {t('peraCard.auto_funding_signing.body')}
                </PWText>
            </PWView>
            {!!error && (
                <PWText style={styles.errorText}>
                    {t('peraCard.auto_funding_signing.error_body')}
                </PWText>
            )}
        </PWScreen>
    )
}
