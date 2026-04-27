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

import { useMemo } from 'react'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import {
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { AccountDisplay } from '@modules/accounts/components/AccountDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { ConfirmActionBottomSheet } from '@components/ConfirmActionBottomSheet'
import { useRekeyConfirmScreen } from './useRekeyConfirmScreen'
import { useStyles } from './styles'

export const RekeyConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        source,
        target,
        currentAuth,
        feeMicroAlgos,
        feePending,
        hasPreviousRekey,
        isSubmitting,
        isWarningOpen,
        handleConfirmPress,
        handleWarningConfirm,
        handleWarningClose,
    } = useRekeyConfirmScreen()

    const formattedFee = useMemo(() => {
        if (feePending || feeMicroAlgos === undefined) return ''
        const algoAmount = microAlgosToAlgos(feeMicroAlgos)
        return algoAmount.toFixed(ALGO_ASSET.decimals)
    }, [feeMicroAlgos, feePending])

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-standard-confirm-screen'
        >
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.header}>
                    <PWText variant='h1'>
                        {t('rekey.to_standard.confirm.title')}
                    </PWText>
                    <PWText
                        variant='bodyLarge'
                        style={styles.body}
                    >
                        {t('rekey.to_standard.confirm.body')}
                    </PWText>
                </PWView>

                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodySemibold'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.to_standard.confirm.summary_label')}
                    </PWText>

                    <PWView style={styles.summaryCard}>
                        <AccountDisplay
                            account={source ?? undefined}
                            showChevron={false}
                            noBorder
                        />
                        <PWView style={styles.arrowRow}>
                            <PWIcon
                                name='arrow-down'
                                variant='helper'
                            />
                        </PWView>
                        <AccountDisplay
                            account={target ?? undefined}
                            showChevron={false}
                            noBorder
                        />
                    </PWView>
                </PWView>

                {hasPreviousRekey && currentAuth && (
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t('rekey.to_standard.confirm.current_auth_label')}
                        </PWText>
                        <PWText variant='bodyLarge'>{currentAuth.name}</PWText>
                    </PWView>
                )}
            </PWScrollView>

            <PWView style={styles.footer}>
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.rowLabel}
                    >
                        {t('rekey.to_standard.confirm.fee_label')}
                    </PWText>
                    <PWText variant='bodyLarge'>{`✓${formattedFee}`}</PWText>
                </PWView>

                <PWButton
                    variant='primary'
                    title={t('rekey.to_standard.confirm.cta')}
                    onPress={handleConfirmPress}
                    isLoading={isSubmitting}
                    isDisabled={!source || !target || feePending}
                    style={styles.cta}
                    testID='rekey-to-standard-confirm-cta'
                />
            </PWView>

            <ConfirmActionBottomSheet
                isVisible={isWarningOpen}
                onClose={handleWarningClose}
                onConfirm={handleWarningConfirm}
                title={t('rekey.to_standard.confirm.replace_warning.title')}
                message={t('rekey.to_standard.confirm.replace_warning.body', {
                    currentAuth: currentAuth?.name ?? '',
                    source: source?.name ?? '',
                })}
                confirmLabel={t(
                    'rekey.to_standard.confirm.replace_warning.confirm',
                )}
                cancelLabel={t(
                    'rekey.to_standard.confirm.replace_warning.cancel',
                )}
                confirmVariant='destructive'
                testID='rekey-previous-rekey-warning-sheet'
            />
        </PWView>
    )
}
