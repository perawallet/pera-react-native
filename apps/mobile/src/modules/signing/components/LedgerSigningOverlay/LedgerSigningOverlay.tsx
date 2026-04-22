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
import { ActivityIndicator } from 'react-native'
import { PWBottomSheet, PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

type LedgerSigningOverlayProps = {
    isVisible: boolean
    status: 'connecting' | 'confirming' | 'error' | 'timeout'
    currentTx?: number
    totalTxs?: number
    onCancel: () => void
    onRetry?: () => void
}

const STATUS_MESSAGE_KEYS: Record<LedgerSigningOverlayProps['status'], string> =
    {
        connecting: 'ledger.signing.connect',
        confirming: 'ledger.signing.confirm',
        timeout: 'ledger.signing.timeout',
        error: 'ledger.errors.connection_failed',
    }

export const LedgerSigningOverlay = ({
    isVisible,
    status,
    currentTx,
    totalTxs,
    onCancel,
    onRetry,
}: LedgerSigningOverlayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const showRetry = status === 'error' || status === 'timeout'
    const showProgress =
        status === 'confirming' &&
        typeof currentTx === 'number' &&
        typeof totalTxs === 'number' &&
        totalTxs > 1

    return (
        <PWBottomSheet
            isVisible={isVisible}
            enablePanDownToClose={false}
            enableCloseOnBackdropPress={false}
        >
            <PWView style={styles.container}>
                <PWText style={styles.title}>
                    {t('ledger.signing.title')}
                </PWText>

                {/* TODO(PERA-ledger): swap ActivityIndicator for a Lottie
                    animation (port bluetooth_loading_animation.json from
                    Android or dark-ledger/light-ledger JSON from iOS) to
                    reach native parity on the signing overlay visual. */}
                {!showRetry && (
                    <ActivityIndicator
                        size='large'
                        style={styles.indicator}
                    />
                )}

                <PWText style={styles.message}>
                    {t(STATUS_MESSAGE_KEYS[status])}
                </PWText>

                {showProgress && (
                    <PWText style={styles.progress}>
                        {t('ledger.signing.progress', {
                            current: currentTx,
                            total: totalTxs,
                        })}
                    </PWText>
                )}

                <PWView style={styles.actions}>
                    {showRetry && onRetry && (
                        <PWButton
                            variant='primary'
                            title={t('ledger.fetch_accounts.retry')}
                            onPress={onRetry}
                            style={styles.retryButton}
                        />
                    )}
                    <PWButton
                        variant='secondary'
                        title={t('ledger.signing.cancel')}
                        onPress={onCancel}
                    />
                </PWView>
            </PWView>
        </PWBottomSheet>
    )
}
