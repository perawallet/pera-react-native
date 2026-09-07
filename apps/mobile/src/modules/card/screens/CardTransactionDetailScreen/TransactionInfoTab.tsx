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

import type { CardTransaction } from '@perawallet/wallet-core-card'
import { PWScrollView, PWText } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useLanguage } from '@hooks/useLanguage'
import { formatCardTransactionDateTime } from '../../utils/cardTransactions'
import { DetailRow } from './DetailRow'
import { TransactionHashRow } from './TransactionHashRow'
import { useStyles } from './styles'

type TransactionInfoTabProps = {
    transaction: CardTransaction
}

export const TransactionInfoTab = ({
    transaction,
}: TransactionInfoTabProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const processedOn = formatCardTransactionDateTime(transaction.dateTime)
    // The on-chain hash lives on the funding leg (card transactions have none).
    const fundingSource = transaction.fundingSources.find(
        source => source.txHash,
    )
    // Fees are charges, shown negative; a negative wire fee is a credit back
    // to the user and must keep its sign (+) instead of being flipped.
    const fees = transaction.feesInTransactionCurrency
    const feesPrefix = fees.isZero() ? undefined : fees.isNegative() ? '+' : '-'

    return (
        <PWScrollView
            style={styles.tabContent}
            showsVerticalScrollIndicator={false}
        >
            {transaction.panLast4 ? (
                <DetailRow
                    title={t('peraCard.transactions.detail_card_number')}
                    testID='card_transaction_detail_card_number'
                >
                    <PWText variant='body'>{`*${transaction.panLast4}`}</PWText>
                </DetailRow>
            ) : null}
            {processedOn ? (
                <DetailRow
                    title={t('peraCard.transactions.detail_processed_on')}
                >
                    <PWText variant='body'>{processedOn}</PWText>
                </DetailRow>
            ) : null}
            {transaction.transactionId ? (
                <DetailRow
                    title={t('peraCard.transactions.detail_reference')}
                    testID='card_transaction_detail_reference'
                >
                    <PWText variant='body'>{transaction.transactionId}</PWText>
                </DetailRow>
            ) : null}
            {fundingSource?.txHash ? (
                <TransactionHashRow
                    txHash={fundingSource.txHash}
                    network={fundingSource.network}
                />
            ) : null}
            {feesPrefix ? (
                <DetailRow title={t('peraCard.transactions.detail_fees')}>
                    <CurrencyAmount
                        value={fees.abs()}
                        currency={transaction.transactionCurrency}
                        precision='compact'
                        prefix={feesPrefix}
                        symbolPosition='end'
                        variant='body'
                    />
                </DetailRow>
            ) : null}
        </PWScrollView>
    )
}
