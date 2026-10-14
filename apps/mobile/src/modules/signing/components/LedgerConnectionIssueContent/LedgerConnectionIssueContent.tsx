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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useLedgerSigningContent } from '../LedgerSigningContent/useLedgerSigningContent'
import { useStyles } from './styles'
import { i18nKey } from '@perawallet/wallet-core-chain-contract'

const TIP_KEYS = [
    i18nKey('ledger.troubleshooting.tip_unlocked'),
    i18nKey('ledger.troubleshooting.tip_nearby'),
    i18nKey('ledger.troubleshooting.tip_bluetooth'),
    i18nKey('ledger.troubleshooting.tip_app_open'),
    i18nKey('ledger.troubleshooting.tip_repair'),
] as const

/**
 * Pure presentational content for the Ledger troubleshooting bottom sheet.
 * The sheet chrome (PWBottomSheet) is provided by the bottom-sheet manager;
 * this component renders only the body.
 */
export const LedgerConnectionIssueContent = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles({ bottomInset: insets.bottom })
    const { t } = useLanguage()
    // Re-run the signing actor after the user fixes the connection (unlock the
    // device, open the app, re-enable Bluetooth). The retry re-runs the
    // hardware strategy, which clears the error and reopens the signing
    // overlay; this troubleshooting sheet then auto-dismisses once the store
    // leaves the error state.
    const { onRetry } = useLedgerSigningContent()

    return (
        <PWView style={styles.container}>
            <PWText style={styles.title}>
                {t('ledger.troubleshooting.title')}
            </PWText>

            {TIP_KEYS.map(key => (
                <PWView
                    key={key}
                    style={styles.bulletWrapper}
                >
                    <PWText style={styles.bullet}>{'•'}</PWText>
                    <PWText style={styles.tip}>{t(key)}</PWText>
                </PWView>
            ))}

            <PWButton
                variant='primary'
                title={t('ledger.signing.retry')}
                onPress={onRetry}
                style={styles.closeButton}
                testID='ledger-troubleshooting-retry'
            />
        </PWView>
    )
}
