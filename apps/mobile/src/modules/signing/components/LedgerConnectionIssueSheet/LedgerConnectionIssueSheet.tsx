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
import { PWBottomSheet, PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'

const TIP_KEYS = [
    'ledger.troubleshooting.tip_unlocked',
    'ledger.troubleshooting.tip_nearby',
    'ledger.troubleshooting.tip_bluetooth',
    'ledger.troubleshooting.tip_app_open',
    'ledger.troubleshooting.tip_repair',
] as const

export type LedgerConnectionIssueSheetProps = {
    isVisible: boolean
    onClose: () => void
}

export const LedgerConnectionIssueSheet = ({
    isVisible,
    onClose,
}: LedgerConnectionIssueSheetProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    return (
        <PWBottomSheet
            isVisible={isVisible}
            enablePanDownToClose
            enableCloseOnBackdropPress
            onBackdropPress={onClose}
            onDismiss={onClose}
        >
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
                    variant='secondary'
                    title={t('ledger.troubleshooting.close')}
                    onPress={onClose}
                    style={styles.closeButton}
                    testID='ledger-troubleshooting-close'
                />
            </PWView>
        </PWBottomSheet>
    )
}
