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

import { useTheme } from '@rneui/themed'
import { PWSheetLayout, PWText, PWView } from '@components/core'
import { AddressDisplay } from '@components/AddressDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { SheetHeader } from '@modules/bottom-sheet'
import type { RampHistoryItem } from '@perawallet/wallet-core-onramp'
import { OnrampAssetPairIcon } from '../OnrampAssetPairIcon'
import { OnrampDetailRow } from '../OnrampDetailRow'
import { OnrampOrderStatus } from '../OnrampOrderStatus'
import { OnrampPayInCard } from '../OnrampPayInCard'
import { OnrampContactProviderCard } from '../OnrampContactProviderCard'
import { useOnrampOrderDetails } from './useOnrampOrderDetails'
import { useStyles } from './styles'

export type OnrampOrderDetailsContentProps = {
    item: RampHistoryItem
    /** Sheet title — defaults to "Order Details" (the form passes "Swap Review"
     *  when showing a freshly-placed order). */
    title?: string
}

export const OnrampOrderDetailsContent = ({
    item,
    title,
}: OnrampOrderDetailsContentProps) => {
    const { t } = useLanguage()
    const { theme } = useTheme()
    const styles = useStyles()

    const {
        providerName,
        isXo,
        isPendingXo,
        sourceAmountLabel,
        destinationAmountLabel,
        networkName,
        paymentMethodName,
        createdAtLabel,
        exchangeRateLabel,
        toAddress,
        sourceLogo,
        payInAddress,
        payInAddressTag,
        contactOrderId,
        isCancelling,
        handleCancelOrder,
    } = useOnrampOrderDetails(item)

    const hasSummary =
        item.status === 'completed' &&
        sourceAmountLabel !== null &&
        destinationAmountLabel !== null

    return (
        <PWSheetLayout
            header={
                <SheetHeader
                    title={title ?? t('onramp.order_details.title')}
                    subtitle={<OnrampOrderStatus status={item.status} />}
                    showClose
                    testID='onramp-order-details'
                    paddingStyle='none'
                />
            }
        >
            <PWView style={styles.container}>
                {hasSummary && (
                    <PWView style={styles.summaryCard}>
                        <OnrampAssetPairIcon
                            sourceToken={item.pair.sourceToken}
                            destinationToken={item.pair.destinationToken}
                            surfaceColor={theme.colors.positiveLighter}
                        />
                        <PWView style={styles.summaryTextColumn}>
                            <PWText
                                variant='body'
                                style={styles.summaryText}
                            >
                                {t('onramp.order_details.swapped')}{' '}
                                <PWText variant='bodySemibold'>
                                    {sourceAmountLabel}
                                </PWText>{' '}
                                {t('onramp.history.for')}{' '}
                                <PWText variant='bodySemibold'>
                                    {destinationAmountLabel}
                                </PWText>
                            </PWText>
                            <PWText
                                variant='caption'
                                style={styles.summaryDate}
                            >
                                {createdAtLabel}
                            </PWText>
                        </PWView>
                    </PWView>
                )}

                {isPendingXo && payInAddress !== null && (
                    <OnrampPayInCard
                        payInAddress={payInAddress}
                        payInAddressTag={payInAddressTag}
                        sendToAddressAmount={sourceAmountLabel}
                        sourceLogo={sourceLogo}
                        onCancel={() => void handleCancelOrder()}
                        isCancelling={isCancelling}
                    />
                )}

                <PWView style={styles.detailsSection}>
                    <OnrampDetailRow
                        label={t('onramp.order_details.order_id')}
                        value={item.id}
                    />
                    {sourceAmountLabel !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.source_amount')}
                            value={sourceAmountLabel}
                        />
                    )}
                    {destinationAmountLabel !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.destination_amount')}
                            value={destinationAmountLabel}
                        />
                    )}
                    {networkName !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.network')}
                            value={networkName}
                        />
                    )}
                    {paymentMethodName !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.payment_method')}
                            value={paymentMethodName}
                        />
                    )}
                    <OnrampDetailRow
                        label={t('onramp.order_details.created_at')}
                        value={createdAtLabel}
                    />
                    {exchangeRateLabel !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.exchange_rate')}
                            value={exchangeRateLabel}
                        />
                    )}
                    {toAddress !== null && (
                        <OnrampDetailRow
                            label={t('onramp.order_details.to_address')}
                        >
                            <AddressDisplay
                                address={toAddress}
                                displayType='full'
                                showCopy={false}
                                hugContent
                                textProps={{ variant: 'body' }}
                            />
                        </OnrampDetailRow>
                    )}
                </PWView>

                {isXo && (
                    <OnrampContactProviderCard
                        providerName={providerName}
                        orderId={contactOrderId}
                    />
                )}
            </PWView>
        </PWSheetLayout>
    )
}
