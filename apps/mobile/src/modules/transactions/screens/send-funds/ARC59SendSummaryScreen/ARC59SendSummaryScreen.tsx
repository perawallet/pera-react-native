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

import {
    PWButton,
    PWScreen,
    PWSlideToConfirm,
    PWText,
    PWView,
} from '@components/core'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useARC59SendSummaryScreen } from './useARC59SendSummaryScreen'
import { AddressDisplay } from '@components/AddressDisplay'
import { AssetAmount } from '@components/AssetAmount'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { AssetTitle } from '@modules/assets/components'
import { LoadingView } from '@components/LoadingView'

export const ARC59SendSummaryScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        summary,
        isLoading,
        amount,
        assetId,
        recipientAddress,
        fee,
        asset,
        HeaderImageComponent,
        handleSend,
        handleClose,
        handleReadMore,
        isProcessing,
    } = useARC59SendSummaryScreen()

    if (isLoading) {
        return <LoadingView variant='circle' />
    }

    return (
        <PWScreen
            footer={
                <PWView style={styles.footer}>
                    <PWSlideToConfirm
                        title={t('common.slide_to_confirm.label')}
                        onConfirm={handleSend}
                        isLoading={isProcessing}
                        isDisabled={!summary}
                        testID='arc59_send_confirm_slide'
                    />
                    <PWButton
                        title={t('common.go_back.label')}
                        variant='linkNeutral'
                        onPress={handleClose}
                        testID='arc59_go_back_button'
                    />
                </PWView>
            }
        >
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

                <PWView style={styles.details}>
                    <PWView style={styles.row}>
                        <PWView style={styles.rowAssetContainer}>
                            {asset ? (
                                <AssetTitle
                                    asset={asset}
                                    nameVariant='h4'
                                />
                            ) : (
                                <PWText variant='h4'>{assetId}</PWText>
                            )}
                        </PWView>
                        <AssetAmount
                            value={amount}
                            asset={asset}
                            variant='h4'
                            ignorePrivacyMode
                        />
                    </PWView>

                    <PWView style={styles.divider} />

                    <PWView style={styles.row}>
                        <PWText style={styles.rowLabel}>
                            {t('send_funds.arc59_summary.recipient_label')}
                        </PWText>
                        <AddressDisplay address={recipientAddress} />
                    </PWView>

                    <PWView style={styles.divider} />

                    <PWView style={styles.row}>
                        <PWText style={styles.rowLabel}>
                            {t('send_funds.arc59_summary.fees_label')}
                        </PWText>
                        <AssetAmount
                            value={fee}
                            asset={ALGO_ASSET}
                            ignorePrivacyMode
                        />
                    </PWView>

                    <PWText style={styles.disclaimer}>
                        {t('send_funds.arc59_summary.disclaimer')}
                    </PWText>
                </PWView>
            </PWView>
        </PWScreen>
    )
}
