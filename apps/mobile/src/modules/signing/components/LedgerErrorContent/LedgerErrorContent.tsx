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
import { PWButton, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import type { LedgerErrorPreset } from '@modules/ledger/utils/ledgerErrorPresets'
import { useStyles } from './styles'

export type LedgerErrorContentProps = {
    error: LedgerErrorPreset
    onRetry: () => void
    onClose: () => void
    onOpenTroubleshooting: () => void
}

export const LedgerErrorContent = ({
    error,
    onRetry,
    onClose,
    onOpenTroubleshooting,
}: LedgerErrorContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>{error.title}</PWText>
            <PWText style={styles.body}>{error.body}</PWText>

            {error.isTroubleshootable && (
                <PWTouchableOpacity
                    onPress={onOpenTroubleshooting}
                    testID='ledger-error-troubleshoot'
                >
                    <PWText style={styles.troubleshootLink}>
                        {t('ledger.errors.troubleshooting_link')}
                    </PWText>
                </PWTouchableOpacity>
            )}

            <PWView style={styles.actions}>
                {error.isRetryable && (
                    <PWButton
                        variant='primary'
                        title={t('ledger.signing.retry')}
                        onPress={onRetry}
                        style={styles.retryButton}
                        testID='ledger-error-retry'
                    />
                )}
                <PWButton
                    variant='secondary'
                    title={t('ledger.signing.cancel')}
                    onPress={onClose}
                    testID='ledger-error-close'
                />
            </PWView>
        </PWView>
    )
}
