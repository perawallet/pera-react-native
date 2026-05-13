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
import LottieView from 'lottie-react-native'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import bluetoothAnimationLight from '@assets/animations/ledger-bluetooth.json'
import bluetoothAnimationDark from '@assets/animations/ledger-bluetooth.dark.json'
import {
    useLedgerSigningContent,
    type LedgerSigningStatus,
} from './useLedgerSigningContent'
import { useStyles } from './styles'

const STATUS_MESSAGE_KEYS: Record<LedgerSigningStatus, string> = {
    connecting: 'ledger.signing.connect',
    confirming: 'ledger.signing.confirm',
    timeout: 'ledger.signing.timeout',
    error: 'ledger.errors.connection_failed',
}

/**
 * Body of the Ledger hardware-wallet signing bottom sheet. Mounted by
 * `useLedgerSigningDriver` in `SigningOverlays` while a hardware signing
 * session is active.
 */
export const LedgerSigningContent = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()
    const { status, currentTx, totalTxs, onCancel, onRetry } =
        useLedgerSigningContent()

    const animationSource = isDarkMode
        ? bluetoothAnimationDark
        : bluetoothAnimationLight

    const showRetry = status === 'error' || status === 'timeout'
    const showProgress =
        status === 'confirming' &&
        typeof currentTx === 'number' &&
        typeof totalTxs === 'number' &&
        totalTxs > 1

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>{t('ledger.signing.title')}</PWText>

            {!showRetry && (
                <LottieView
                    autoPlay
                    loop
                    source={animationSource}
                    style={styles.lottie}
                    testID='ledger-signing-content-lottie'
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
                {showRetry && (
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
    )
}
