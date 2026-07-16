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

import { useCallback } from 'react'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { RekeySummaryRow } from '../RekeySummaryRow'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

// Shared presentation for the rekey-to-{ledger,shared,standard} confirm screens.
// They share an identical layout and differ only in their i18n namespace,
// testID prefix, and support URL.
type RekeyConfirmViewProps = {
    i18nPrefix: string
    testIDPrefix: string
    supportUrl: string
    source: WalletAccount | null
    target: WalletAccount | null
    currentAuth: WalletAccount | null
    feeAlgos: Decimal | undefined
    feePending: boolean
    hasPreviousRekey: boolean
    isSubmitting: boolean
    isUnderfunded: boolean
    onConfirmPress: () => void
}

export const RekeyConfirmView = ({
    i18nPrefix,
    testIDPrefix,
    supportUrl,
    source,
    target,
    currentAuth,
    feeAlgos,
    feePending,
    hasPreviousRekey,
    isSubmitting,
    isUnderfunded,
    onConfirmPress,
}: RekeyConfirmViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: supportUrl })
    }, [pushWebView, supportUrl])

    return (
        <PWScreen
            style={styles.container}
            testID={`${testIDPrefix}-confirm-screen`}
            footer={
                <PWView style={styles.footer}>
                    {hasPreviousRekey && currentAuth && (
                        <PWView style={styles.currentAuthRow}>
                            <PWText
                                variant='bodyLarge'
                                style={styles.rowLabel}
                            >
                                {t(`${i18nPrefix}.current_auth_label`)}
                            </PWText>
                            <RekeySummaryRow account={currentAuth} />
                        </PWView>
                    )}
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t(`${i18nPrefix}.fee_label`)}
                        </PWText>
                        <AssetAmount
                            asset={ALGO_ASSET}
                            value={feeAlgos}
                            variant='bodyLarge'
                        />
                    </PWView>

                    {isUnderfunded && (
                        <PWText
                            variant='footnoteMedium'
                            style={styles.underfundedNotice}
                            testID={`${testIDPrefix}-underfunded-notice`}
                        >
                            {t('rekey.confirm.insufficient_fee_balance', {
                                fee: feeAlgos?.toString() ?? '',
                            })}
                        </PWText>
                    )}

                    <PWButton
                        variant='primary'
                        title={t(`${i18nPrefix}.cta`)}
                        onPress={onConfirmPress}
                        isLoading={isSubmitting}
                        isDisabled={
                            !source || !target || feePending || isUnderfunded
                        }
                        style={styles.cta}
                        testID={`${testIDPrefix}-confirm-cta`}
                    />
                </PWView>
            }
        >
            <PWView style={styles.scrollContent}>
                <ScreenHeader
                    title={t(`${i18nPrefix}.title`)}
                    description={
                        <>
                            {t(`${i18nPrefix}.body`)}{' '}
                            <PWText
                                variant='bodyLarge'
                                style={styles.learnMore}
                                onPress={handleLearnMore}
                            >
                                {t(`${i18nPrefix}.learn_more`)}
                            </PWText>
                        </>
                    }
                />
                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t(`${i18nPrefix}.summary_label`)}
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
            </PWView>
        </PWScreen>
    )
}
