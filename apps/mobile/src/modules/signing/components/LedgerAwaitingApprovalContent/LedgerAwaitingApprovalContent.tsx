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
import { type I18nKey, i18nKey } from '@perawallet/wallet-core-chain-contract'
import { PWButton, PWLottie, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useIsDarkMode } from '@hooks/useIsDarkMode'
import type { HardwareSigningOperation } from '@perawallet/wallet-core-signing'
import type { Nullable } from '@perawallet/wallet-core-shared'
import animationSourceLight from '@assets/animations/ledger-signing.json'
import animationSourceDark from '@assets/animations/ledger-signing.dark.json'
import { useStyles } from './styles'

export type LedgerAwaitingApprovalContentProps = {
    deviceName: Nullable<string>
    currentTx: Nullable<number>
    totalTxs: Nullable<number>
    operation: HardwareSigningOperation
    onCancel: () => void
}

type AwaitingApprovalCopy = {
    titleKey: I18nKey
    bodyKey: I18nKey
    bodyNoDeviceKey: I18nKey
}

const COPY_BY_OPERATION: Record<
    HardwareSigningOperation,
    AwaitingApprovalCopy
> = {
    transaction: {
        titleKey: i18nKey('ledger.signing.awaitingApproval.title'),
        bodyKey: i18nKey('ledger.signing.awaitingApproval.body'),
        bodyNoDeviceKey: i18nKey(
            'ledger.signing.awaitingApproval.body_noDevice',
        ),
    },
    data: {
        titleKey: i18nKey('ledger.signing.awaitingApprovalData.title'),
        bodyKey: i18nKey('ledger.signing.awaitingApprovalData.body'),
        bodyNoDeviceKey: i18nKey(
            'ledger.signing.awaitingApprovalData.body_noDevice',
        ),
    },
}

export const LedgerAwaitingApprovalContent = ({
    deviceName,
    currentTx,
    totalTxs,
    operation,
    onCancel,
}: LedgerAwaitingApprovalContentProps) => {
    const { t } = useLanguage()
    const isDarkMode = useIsDarkMode()

    const animationSource = isDarkMode
        ? animationSourceDark
        : animationSourceLight

    const showProgress =
        typeof currentTx === 'number' &&
        typeof totalTxs === 'number' &&
        totalTxs > 1

    const copy = COPY_BY_OPERATION[operation]
    const titleKey = copy.titleKey
    const bodyKey = deviceName ? copy.bodyKey : copy.bodyNoDeviceKey

    const progressFillPercent =
        showProgress && totalTxs !== null && totalTxs > 0 && currentTx !== null
            ? Math.min(100, Math.max(0, (currentTx / totalTxs) * 100))
            : 0

    const insets = useSafeAreaInsets()
    const styles = useStyles({
        progressFillPercent,
        bottomInset: insets.bottom,
    })

    return (
        <PWView style={styles.container}>
            <PWLottie
                autoPlay
                loop
                source={animationSource}
                style={styles.lottie}
                testID='ledger-signing-overlay-lottie'
            />

            <PWText style={styles.title}>{t(titleKey)}</PWText>

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
                        <PWView style={styles.progressBarFill} />
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
