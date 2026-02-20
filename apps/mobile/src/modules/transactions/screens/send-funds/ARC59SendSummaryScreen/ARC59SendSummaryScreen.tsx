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

import { PWButton, PWText, PWView } from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { ARC59WarningBottomSheet } from '@modules/transactions/components/send-funds/ARC59WarningBottomSheet'
import { useStyles } from './styles'
import { useARC59SendSummaryScreen } from './useARC59SendSummaryScreen'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'
import { AssetTitle } from '@modules/assets/components'
import { LoadingView } from '@components/LoadingView'

export const ARC59SendSummaryScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        isLoading,
        isWarningVisible,
        amount,
        assetId,
        fee,
        asset,
        HeaderImageComponent,
        handleSend,
        handleClose,
        handleReadMore,
        handleWarningConfirm,
        handleWarningClose,
    } = useARC59SendSummaryScreen()

    if (isLoading) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWView style={styles.container}>
            <PWView style={styles.content}>
                <PWText
                    variant='h3'
                    style={styles.title}
                >
                    {t('send_funds.arc59_summary.title')}
                </PWText>

                <PWView style={styles.header}>
                    <HeaderImageComponent style={styles.inboxIcon} />

                    <PWText style={styles.description}>
                        {t('send_funds.arc59_summary.description')}{' '}
                        <PWText
                            style={styles.readMoreText}
                            onPress={handleReadMore}
                        >
                            {t('send_funds.arc59_summary.read_more')}
                        </PWText>
                    </PWText>
                </PWView>

                <PWView style={styles.bottomContainer}>
                    <PWView style={styles.row}>
                        {asset ? (
                            <AssetTitle
                                asset={asset}
                                nameVariant='h3'
                            />
                        ) : (
                            <PWText variant='h3'>{assetId}</PWText>
                        )}
                        <CurrencyDisplay
                            value={amount}
                            currency={asset?.unitName ?? ''}
                            precision={asset?.decimals ?? DEFAULT_PRECISION}
                            minPrecision={DEFAULT_PRECISION}
                            variant='h3'
                        />
                    </PWView>

                    <PWView style={styles.divider} />

                    <PWView style={styles.row}>
                        <PWText style={styles.rowLabel}>
                            {t('send_funds.arc59_summary.fees_label')}
                        </PWText>
                        <CurrencyDisplay
                            value={fee}
                            currency={'ALGO'}
                            precision={ALGO_ASSET.decimals}
                            minPrecision={DEFAULT_PRECISION}
                        />
                    </PWView>

                    <PWText style={styles.disclaimer}>
                        {t('send_funds.arc59_summary.disclaimer')}
                    </PWText>
                </PWView>
            </PWView>

            <PWView style={styles.footer}>
                <PWButton
                    title={t('send_funds.arc59_summary.send_button')}
                    variant='primary'
                    onPress={handleSend}
                />
                <PWButton
                    title={t('send_funds.arc59_summary.close_button')}
                    variant='secondary'
                    onPress={handleClose}
                />
            </PWView>

            <ARC59WarningBottomSheet
                isVisible={isWarningVisible}
                onClose={handleWarningClose}
                onConfirm={handleWarningConfirm}
            />
        </PWView>
    )
}
