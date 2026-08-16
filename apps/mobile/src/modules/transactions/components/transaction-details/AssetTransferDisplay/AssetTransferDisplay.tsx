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

import { PWButton, PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionFeeRow } from '../TransactionFeeRow/TransactionFeeRow'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { AssetAmount } from '@components/AssetAmount'
import { LoadingView } from '@components/LoadingView'
import { AssetTitle } from '@modules/assets/components/AssetTitle'
import { ViewTextDetailsContent } from '../../ViewTextDetailsContent'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useCallback } from 'react'
import { useAssetTransferDisplay } from './useAssetTransferDisplay'

export type AssetTransferDisplayProps = {
    referenceAddress?: string
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

export const AssetTransferDisplay = ({
    referenceAddress,
    transaction,
    isInnerTransaction = false,
}: AssetTransferDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const {
        asset,
        isAssetPending,
        transferType,
        senderAddress,
        receiverAddress,
        closeToAddress,
        closeAmountValue,
        amount,
        amountStyle,
        metadataHash,
        assetTransfer,
        showWarnings,
    } = useAssetTransferDisplay(transaction, referenceAddress)

    const { request: requestBottomSheet } = useBottomSheet()
    const openMetadataHashDetails = useCallback(() => {
        if (!metadataHash) return
        void requestBottomSheet({
            contents: (
                <ViewTextDetailsContent
                    text={metadataHash}
                    title={t('transactions.common.view_metadata')}
                />
            ),
            options: {
                size: 'auto',
                enablePanDownToClose: true,
                autoCreateContainer: false,
            },
        })
    }, [metadataHash, requestBottomSheet, t])

    if (!assetTransfer) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <KeyValueRow title={t('transactions.common.asset')}>
                    <PWView style={styles.detailRow}>
                        {asset ? (
                            <AssetTitle
                                asset={asset}
                                nameVariant='body'
                                showId
                            />
                        ) : isAssetPending ? (
                            <LoadingView
                                size='sm'
                                variant='circle'
                            />
                        ) : (
                            <PWText variant='body'>
                                {t('transactions.common.asset_unavailable')}
                            </PWText>
                        )}
                    </PWView>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.from')}>
                    <PWView style={styles.detailRow}>
                        <AddressDisplay address={senderAddress} />
                    </PWView>
                </KeyValueRow>

                {transferType !== 'opt-in' && (
                    <KeyValueRow title={t('transactions.common.sent_to')}>
                        <PWView style={styles.detailRow}>
                            <AddressDisplay address={receiverAddress ?? ''} />
                        </PWView>
                    </KeyValueRow>
                )}

                {transferType !== 'opt-in' && (asset || isAssetPending) && (
                    <KeyValueRow title={t('transactions.common.amount')}>
                        <AssetAmount
                            isLoading={isAssetPending}
                            asset={asset}
                            value={amount}
                            showSymbol
                            style={amountStyle}
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                )}

                {closeToAddress && (
                    <KeyValueRow
                        testID='transaction_detail_close_to'
                        title={t('transactions.common.close_to')}
                    >
                        <PWView style={styles.detailRow}>
                            <AddressDisplay address={closeToAddress} />
                        </PWView>
                    </KeyValueRow>
                )}

                {closeToAddress && closeAmountValue && (
                    <KeyValueRow
                        testID='transaction_detail_close_amount'
                        title={t('transactions.common.close_amount')}
                    >
                        <AssetAmount
                            isLoading={isAssetPending}
                            asset={asset}
                            value={closeAmountValue}
                            showSymbol
                            ignorePrivacyMode
                        />
                    </KeyValueRow>
                )}

                {assetTransfer.sender && (
                    <KeyValueRow
                        title={t('transactions.asset_transfer.clawback_from')}
                    >
                        <PWView style={styles.detailRow}>
                            <AddressDisplay address={assetTransfer.sender} />
                        </PWView>
                    </KeyValueRow>
                )}

                {metadataHash && (
                    <KeyValueRow
                        title={t('transactions.asset_config.metadata_hash')}
                    >
                        <PWButton
                            variant='linkPositive'
                            paddingStyle='none'
                            title={t('transactions.common.view_metadata')}
                            onPress={openMetadataHashDetails}
                        />
                    </KeyValueRow>
                )}

                <TransactionFeeRow transaction={transaction} />

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
