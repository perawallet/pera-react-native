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

import { useCallback, useMemo } from 'react'
import { Trans } from 'react-i18next'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { config } from '@perawallet/wallet-core-config'
import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { RekeySummaryRow } from '../../../components/RekeySummaryRow'
import { useStyles } from './styles'
import { useUndoRekeyConfirmScreen } from './useUndoRekeyConfirmScreen'

export const UndoRekeyConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const {
        source,
        currentAuth,
        feeAlgos,
        feePending,
        isSubmitting,
        isUnderfunded,
        handleContinuePress,
    } = useUndoRekeyConfirmScreen()

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.undoRekeySupportUrl })
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

    if (!source) return null

    return (
        <PWScreen
            testID='undo-rekey-confirm-screen'
            footer={
                <PWView style={styles.footer}>
                    {currentAuth && (
                        <PWView style={styles.currentAuthRow}>
                            <PWText
                                variant='bodyLarge'
                                style={styles.rowLabel}
                            >
                                {t('rekey.undo.confirm.current_auth_label')}
                            </PWText>
                            <RekeySummaryRow account={currentAuth} />
                        </PWView>
                    )}
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t('rekey.undo.confirm.fee_label')}
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
                            testID='undo-rekey-underfunded-notice'
                        >
                            {t('rekey.confirm.insufficient_fee_balance', {
                                fee: feeAlgos?.toString() ?? '',
                            })}
                        </PWText>
                    )}

                    <PWButton
                        variant='primary'
                        title={t('rekey.undo.confirm.cta')}
                        onPress={handleContinuePress}
                        isLoading={isSubmitting}
                        isDisabled={feePending || isUnderfunded}
                        style={styles.cta}
                        testID='undo-rekey-confirm-cta'
                    />
                </PWView>
            }
        >
            <PWView style={styles.scrollContent}>
                <ScreenHeader
                    title={t('rekey.undo.confirm.title')}
                    description={
                        <Trans
                            i18nKey='rekey.undo.confirm.body'
                            components={bodyTransComponents}
                        />
                    }
                />
                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.undo.confirm.summary_label')}
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
                        <RekeySummaryRow
                            account={source}
                            ignoreRekey
                        />
                    </PWView>
                </PWView>

                <PWView style={styles.spacer} />
            </PWView>
        </PWScreen>
    )
}
