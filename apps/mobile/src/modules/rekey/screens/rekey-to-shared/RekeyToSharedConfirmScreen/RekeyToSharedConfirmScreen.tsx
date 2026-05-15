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
import { SafeAreaView } from 'react-native-safe-area-context'
import { Trans } from 'react-i18next'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { config } from '@perawallet/wallet-core-config'
import {
    PWButton,
    PWIcon,
    PWScrollView,
    PWText,
    PWView,
} from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { RekeySummaryRow } from '../../../components/RekeySummaryRow'
import { useStyles } from './styles'
import { useRekeyToSharedConfirmScreen } from './useRekeyToSharedConfirmScreen'

export const RekeyToSharedConfirmScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const {
        source,
        target,
        currentAuth,
        feeAlgos,
        feePending,
        hasPreviousRekey,
        isSubmitting,
        handleConfirmPress,
    } = useRekeyToSharedConfirmScreen()

    const handleLearnMore = useCallback(() => {
        pushWebView({ url: config.rekeyToSharedSupportUrl })
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

    return (
        <PWView
            style={styles.container}
            testID='rekey-to-shared-confirm-screen'
        >
            <ScreenHeader
                title={t('rekey.to_shared.confirm.title')}
                description={
                    <Trans
                        i18nKey='rekey.to_shared.confirm.body'
                        components={bodyTransComponents}
                    />
                }
            />
            <PWScrollView contentContainerStyle={styles.scrollContent}>
                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t('rekey.to_shared.confirm.summary_label')}
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

            <SafeAreaView
                edges={['bottom']}
                style={styles.footer}
            >
                {hasPreviousRekey && currentAuth && (
                    <PWView style={styles.currentAuthRow}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t('rekey.to_shared.confirm.current_auth_label')}
                        </PWText>
                        <RekeySummaryRow account={currentAuth} />
                    </PWView>
                )}
                <PWView style={styles.row}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.rowLabel}
                    >
                        {t('rekey.to_shared.confirm.fee_label')}
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
                    title={t('rekey.to_shared.confirm.cta')}
                    onPress={handleConfirmPress}
                    isLoading={isSubmitting}
                    isDisabled={!source || !target || feePending}
                    style={styles.cta}
                    testID='rekey-to-shared-confirm-cta'
                />
            </SafeAreaView>
        </PWView>
    )
}
