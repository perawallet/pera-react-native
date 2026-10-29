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
import {
    LEGACY_CHAIN_ID,
    type I18nKey,
} from '@perawallet/wallet-core-chain-contract'
import { useNativeAsset } from '@perawallet/wallet-core-assets'
import { PWButton, PWIcon, PWScreen, PWText, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { ScreenHeader } from '@components/ScreenHeader'
import { useWebView } from '@modules/webview'
import { useLanguage } from '@hooks/useLanguage'
import { RekeySummaryRow } from '../RekeySummaryRow'
import { useStyles } from './styles'

import type { Decimal } from 'decimal.js'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

// Shared presentation for the rekey-to-{ledger,shared,standard} confirm screens.
// They share an identical layout and differ only in their copy, testID prefix,
// and support URL.
export type RekeyConfirmCopy = {
    titleKey: I18nKey
    bodyKey: I18nKey
    learnMoreKey: I18nKey
    currentAuthLabelKey: I18nKey
    feeLabelKey: I18nKey
    summaryLabelKey: I18nKey
    ctaKey: I18nKey
}

type RekeyConfirmViewProps = {
    copy: RekeyConfirmCopy
    testIDPrefix: string
    supportUrl: string
    source: Nullable<WalletAccount>
    target: Nullable<WalletAccount>
    currentAuth: Nullable<WalletAccount>
    feeAlgos: Optional<Decimal>
    feePending: boolean
    hasPreviousRekey: boolean
    isSubmitting: boolean
    isUnderfunded: boolean
    onConfirmPress: () => void
}

export const RekeyConfirmView = ({
    copy,
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
    const scope = useSelectedScope(LEGACY_CHAIN_ID)
    const nativeAsset = useNativeAsset(scope)
    const styles = useStyles()
    const { t } = useLanguage()
    const { pushWebView } = useWebView()

    const handleLearnMore = useCallback(() => {
        // oxlint-disable-next-line pera/no-unvalidated-open-url -- every caller passes a config.* support URL
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
                                {t(copy.currentAuthLabelKey)}
                            </PWText>
                            <RekeySummaryRow account={currentAuth} />
                        </PWView>
                    )}
                    <PWView style={styles.row}>
                        <PWText
                            variant='bodyLarge'
                            style={styles.rowLabel}
                        >
                            {t(copy.feeLabelKey)}
                        </PWText>
                        <AssetAmount
                            chainId={scope.chainId}
                            asset={nativeAsset}
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
                        title={t(copy.ctaKey)}
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
                    title={t(copy.titleKey)}
                    description={
                        <>
                            {t(copy.bodyKey)}{' '}
                            <PWText
                                variant='bodyLarge'
                                style={styles.learnMore}
                                onPress={handleLearnMore}
                            >
                                {t(copy.learnMoreKey)}
                            </PWText>
                        </>
                    }
                />
                <PWView style={styles.summarySection}>
                    <PWText
                        variant='bodyLarge'
                        style={styles.summaryLabel}
                    >
                        {t(copy.summaryLabelKey)}
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
