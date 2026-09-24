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
import {
    PWButton,
    PWCheckbox,
    PWText,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from '../styles'
import { useForgotPasswordView } from './useForgotPasswordView'

export type ForgotPasswordViewProps = {
    onCancel: () => void
}

export const ForgotPasswordView = ({
    onCancel,
}: ForgotPasswordViewProps): React.JSX.Element => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        isAcknowledged,
        isResetting,
        hasError,
        toggleAcknowledged,
        handleReset,
    } = useForgotPasswordView()

    return (
        <PWView style={styles.container}>
            <PWText
                variant='h2'
                style={styles.title}
            >
                {t('vault.reset.title')}
            </PWText>
            <PWText
                variant='body'
                style={styles.description}
            >
                {t('vault.reset.body')}
            </PWText>
            <PWText
                variant='body'
                style={styles.description}
            >
                {t('vault.reset.restore_note')}
            </PWText>
            <PWText
                variant='body'
                style={styles.description}
            >
                {t('vault.reset.hardware_note')}
            </PWText>
            <PWTouchableOpacity
                style={styles.acknowledgeRow}
                onPress={toggleAcknowledged}
                disabled={isResetting}
            >
                <PWCheckbox
                    testID='forgot-password-acknowledge'
                    checked={isAcknowledged}
                    onPress={toggleAcknowledged}
                    disabled={isResetting}
                    containerStyle={styles.checkboxContainer}
                />
                <PWText
                    variant='body'
                    style={styles.acknowledgeText}
                >
                    {t('vault.reset.acknowledge')}
                </PWText>
            </PWTouchableOpacity>
            {hasError && (
                <PWText
                    testID='forgot-password-error'
                    variant='body'
                    style={styles.errorText}
                >
                    {t('vault.reset.error')}
                </PWText>
            )}
            <PWButton
                testID='forgot-password-reset'
                variant='destructive'
                title={t('vault.reset.confirm_button')}
                style={styles.unlockButton}
                isDisabled={!isAcknowledged || isResetting}
                isLoading={isResetting}
                onPress={() => void handleReset()}
            />
            <PWButton
                testID='forgot-password-cancel'
                variant='link'
                title={t('common.cancel.label')}
                isDisabled={isResetting}
                onPress={onCancel}
            />
        </PWView>
    )
}
