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

import { PWDivider, PWView } from '@components/core'
import { AssetAmount } from '@components/AssetAmount'
import { type PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { useTheme } from '@rneui/themed'
import { TransactionFeeRow } from '../TransactionFeeRow/TransactionFeeRow'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { usePaymentTransactionDisplay } from './usePaymentTransactionDisplay'

export type PaymentTransactionDisplayProps = {
    referenceAddress?: string
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}

export const PaymentTransactionDisplay = ({
    referenceAddress,
    transaction,
    isInnerTransaction = false,
}: PaymentTransactionDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()
    const {
        amount,
        amountStyle,
        showWarnings,
        receiverAddress,
        senderAddress,
        payment,
    } = usePaymentTransactionDisplay(transaction, referenceAddress)

    if (!payment) {
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
                <KeyValueRow title={t('transactions.common.amount')}>
                    <AssetAmount
                        asset={ALGO_ASSET}
                        value={Decimal(amount)}
                        showSymbol
                        style={amountStyle}
                        ignorePrivacyMode
                    />
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.from')}>
                    <PWView style={styles.detailRow}>
                        <AddressDisplay address={senderAddress} />
                    </PWView>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.to')}>
                    <PWView style={styles.detailRow}>
                        <AddressDisplay address={receiverAddress ?? ''} />
                    </PWView>
                </KeyValueRow>

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
