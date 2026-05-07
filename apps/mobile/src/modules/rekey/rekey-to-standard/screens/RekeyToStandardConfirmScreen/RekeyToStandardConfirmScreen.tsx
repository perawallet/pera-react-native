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

import { useCallback, useMemo } from 'react'
import { Trans } from 'react-i18next'
import { microAlgosToAlgos } from '@perawallet/wallet-core-blockchain'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { getAccountDisplayName } from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import {
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { AccountIcon } from '@modules/accounts/components/AccountIcon'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { ConfirmActionBottomSheet } from '@components/ConfirmActionBottomSheet'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { RekeySummaryRow } from '../../../shared'
import { useRekeyToStandardConfirmScreen } from './useRekeyToStandardConfirmScreen'
import { useStyles } from './styles'

export const RekeyToStandardConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
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
    } = useRekeyToStandardConfirmScreen()

    const feeAlgos = useMemo(() => {
        if (feeMicroAlgos === undefined) return undefined
        return microAlgosToAlgos(feeMicroAlgos)
    }, [feeMicroAlgos])

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.rekeyToStandardSupportUrl })
    }, [pushWebView])

    const bodyTransComponents = useMemo(
        () => [
            <PWText
                key='learn-more'
                variant='bodyLarge'
                style={styles.learnMore}
                onPress={handleLearnMore}
            />,
        ],
        [styles.learnMore, handleLearnMore],
    )

    const warningTransComponents = useMemo(
        () => [
            <PWText
                key='auth'
                variant='bodySemibold'
            />,
            <PWText
                key='source'
                variant='bodySemibold'
            />,
            <PWText
                key='learn-more'
                variant='link'
                onPress={handleLearnMore}
            />,
        ],
        [handleLearnMore],
    )

    const sourceName = source ? getAccountDisplayName(source) : ''
    const currentAuthName = currentAuth
        ? getAccountDisplayName(currentAuth)
        : ''

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
                        <Trans
                            i18nKey='rekey.to_standard.confirm.body'
                            components={bodyTransComponents}
                        />
                    </PWText>
                </PWView>

                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.to_standard.confirm.summary_label')}
                    </PWText>

                    <PWView style={styles.summaryCard}>
                        <RekeySummaryRow account={source} />
                        <PWView style={styles.arrowRow}>
                            <PWIcon
                                name='arrow-down'
                                size='sm'
                                variant='secondary'
                            />
                        </PWView>
                        <RekeySummaryRow account={target} />
                    </PWView>
                </PWView>

                <PWView style={styles.spacer} />
            </PWScrollView>

            <PWView style={styles.footer}>
                {hasPreviousRekey && currentAuth && (
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t('rekey.to_standard.confirm.current_auth_label')}
                        </PWText>
                        <PWView style={styles.currentAuthValue}>
                            <AccountIcon
                                account={currentAuth}
                                size='sm'
                            />
                            <PWText
                                variant='bodyLarge'
                                numberOfLines={1}
                            >
                                {getAccountDisplayName(currentAuth)}
                            </PWText>
                        </PWView>
                    </PWView>
                )}
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.rowLabel}
                    >
                        {t('rekey.to_standard.confirm.fee_label')}
                    </PWText>
                    <CurrencyDisplay
                        currency='ALGO'
                        value={feeAlgos}
                        precision={ALGO_ASSET.decimals}
                        minPrecision={3}
                        variant='bodyLarge'
                    />
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
                icon='warning'
                iconVariant='error'
                title={t('rekey.to_standard.confirm.replace_warning.title')}
                message={
                    <Trans
                        i18nKey='rekey.to_standard.confirm.replace_warning.body'
                        values={{
                            currentAuth: currentAuthName,
                            source: sourceName,
                        }}
                        components={warningTransComponents}
                    />
                }
                confirmLabel={t(
                    'rekey.to_standard.confirm.replace_warning.confirm',
                )}
                cancelLabel={t(
                    'rekey.to_standard.confirm.replace_warning.cancel',
                )}
                onClose={handleWarningClose}
                onConfirm={handleWarningConfirm}
                testID='rekey-to-standard-previous-rekey-warning-sheet'
            />
        </PWView>
    )
}
