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

import { PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import { AddressDisplay } from '@components/AddressDisplay'
import {
    getAssetTransferType,
    microAlgosToAlgos,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { useMemo } from 'react'
import { useSingleAssetDetailsQuery } from '@perawallet/wallet-core-assets'

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

    const transferType = useMemo(
        () => getAssetTransferType(transaction),
        [transaction],
    )
    const showWarnings = useMemo(() => !transaction.id, [transaction])
    const assetId = transaction.assetTransferTransaction?.assetId?.toString()

    const { data: asset } = useSingleAssetDetailsQuery(assetId ?? '')

    const assetTransfer = transaction.assetTransferTransaction

    const senderAddress = transaction.sender
    const receiverAddress = assetTransfer?.receiver
    const amount = useMemo(() => {
        const amount = Decimal(assetTransfer?.amount?.toString() ?? '0')
        return amount
            .dividedBy(new Decimal(10 ** (asset?.decimals ?? 6)))
            .mul(referenceAddress === assetTransfer?.receiver ? -1 : 1)
    }, [assetTransfer?.amount, asset?.decimals])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [amount])

    if (!assetTransfer) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <KeyValueRow title={t('transactions.common.asset')}>
                    <PWView style={styles.detailRow}>
                        <PWView style={styles.assetContainer}>
                            {asset && <PWText>{asset.name}</PWText>}
                            <PWText
                                variant='caption'
                                style={styles.assetId}
                            >
                                {assetId}
                            </PWText>
                        </PWView>
                    </PWView>
                </KeyValueRow>

                {transferType !== 'opt-in' && (
                    <KeyValueRow title={t('transactions.common.amount')}>
                        <CurrencyDisplay
                            isLoading={!asset}
                            currency={asset?.unitName ?? ''}
                            precision={asset?.decimals ?? 6}
                            minPrecision={asset?.decimals ?? 2}
                            value={amount}
                            showSymbol
                            style={amountStyle}
                        />
                    </KeyValueRow>
                )}

                <KeyValueRow title={t('transactions.common.from')}>
                    <PWView style={styles.detailRow}>
                        <AddressDisplay address={senderAddress} />
                    </PWView>
                </KeyValueRow>

                {transferType !== 'opt-in' && (
                    <KeyValueRow title={t('transactions.common.to')}>
                        <PWView style={styles.detailRow}>
                            <AddressDisplay address={receiverAddress ?? ''} />
                        </PWView>
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

                <KeyValueRow title={t('transactions.common.fee')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={6}
                        minPrecision={2}
                        value={Decimal(
                            microAlgosToAlgos(transaction.fee ?? 0n),
                        )}
                        showSymbol
                    />
                </KeyValueRow>

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
