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
import animationSourceLight from '@assets/animations/ledger-signing.json'
import animationSourceDark from '@assets/animations/ledger-signing.dark.json'
import { useStyles } from './styles'

export type LedgerAwaitingApprovalContentProps = {
    deviceName: string | null
    currentTx: number | null
    totalTxs: number | null
    onCancel: () => void
}

export const LedgerAwaitingApprovalContent = ({
    deviceName,
    currentTx,
    totalTxs,
    onCancel,
}: LedgerAwaitingApprovalContentProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()

    const animationSource = isDarkMode
        ? animationSourceDark
        : animationSourceLight

    const showProgress =
        typeof currentTx === 'number' &&
        typeof totalTxs === 'number' &&
        totalTxs > 1

    const bodyKey = deviceName
        ? 'ledger.signing.awaitingApproval.body'
        : 'ledger.signing.awaitingApproval.body_noDevice'

    const progressFillPercent =
        showProgress && totalTxs !== null && totalTxs > 0 && currentTx !== null
            ? Math.min(100, Math.max(0, (currentTx / totalTxs) * 100))
            : 0

    return (
        <PWView style={styles.container}>
            <LottieView
                autoPlay
                loop
                source={animationSource}
                style={styles.lottie}
                testID='ledger-signing-overlay-lottie'
            />

            <PWText style={styles.title}>
                {t('ledger.signing.awaitingApproval.title')}
            </PWText>

            <PWText style={styles.body}>
                {t(bodyKey, deviceName ? { deviceName } : undefined)}
            </PWText>

            {showProgress && (
                <>
                    <PWText style={styles.progressLabel}>
                        {t('ledger.signing.progress.label', {
                            current: currentTx,
                            total: totalTxs,
                        })}
                    </PWText>
                    <PWView
                        style={styles.progressBarTrack}
                        testID='ledger-signing-progress-bar'
                    >
                        <PWView
                            style={[
                                styles.progressBarFill,
                                { width: `${progressFillPercent}%` },
                            ]}
                        />
                    </PWView>
                </>
            )}

            <PWButton
                variant='secondary'
                title={t('ledger.signing.cancel')}
                onPress={onCancel}
                style={styles.cancelButton}
                testID='ledger-signing-cancel'
            />

            <PWText style={styles.footnote}>
                {t('ledger.signing.footnote')}
            </PWText>
        </PWView>
    )
}
