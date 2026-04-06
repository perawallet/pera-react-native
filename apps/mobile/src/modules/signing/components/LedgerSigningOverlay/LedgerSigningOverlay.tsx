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
import { ActivityIndicator, View } from 'react-native'
import { PWBottomSheet, PWButton, PWText } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type LedgerSigningOverlayProps = {
    isVisible: boolean
    status: 'connecting' | 'confirming' | 'error' | 'timeout'
    onCancel: () => void
    onRetry?: () => void
}

export const LedgerSigningOverlay = ({
    isVisible,
    status,
    onCancel,
    onRetry,
}: LedgerSigningOverlayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const getMessage = () => {
        switch (status) {
            case 'connecting':
                return t('ledger.signing.connect')
            case 'confirming':
                return t('ledger.signing.confirm')
            case 'timeout':
                return t('ledger.signing.timeout')
            case 'error':
                return t('ledger.errors.connection_failed')
        }
    }

    const showRetry = status === 'error' || status === 'timeout'

    return (
        <PWBottomSheet
            isVisible={isVisible}
            onDismiss={onCancel}
        >
            <View style={styles.container}>
                <PWText style={styles.title}>
                    {t('ledger.signing.title')}
                </PWText>

                {!showRetry && (
                    <ActivityIndicator
                        size='large'
                        style={styles.indicator}
                    />
                )}

                <PWText style={styles.message}>{getMessage()}</PWText>

                <View style={styles.actions}>
                    {showRetry && onRetry && (
                        <PWButton
                            variant='primary'
                            title={t('ledger.fetch.retry')}
                            onPress={onRetry}
                            style={styles.retryButton}
                        />
                    )}
                    <PWButton
                        variant='secondary'
                        title={t('ledger.signing.cancel')}
                        onPress={onCancel}
                    />
                </View>
            </View>
        </PWBottomSheet>
    )
}
