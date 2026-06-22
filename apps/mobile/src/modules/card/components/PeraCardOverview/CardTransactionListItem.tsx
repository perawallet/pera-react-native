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

import { PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import {
    type CardTransaction,
    TransactionSign,
} from '@perawallet/wallet-core-card'
import { useLanguage } from '@hooks/useLanguage'
import { formatCardTransactionDate } from './utils'
import { useStyles } from './styles'

type CardTransactionListItemProps = {
    transaction: CardTransaction
}

export const CardTransactionListItem = ({
    transaction,
}: CardTransactionListItemProps) => {
    const { t } = useLanguage()
    const styles = useStyles()

    const isDebit = transaction.sign === TransactionSign.Debit
    const subtitle = [
        transaction.mccCategory,
        formatCardTransactionDate(transaction.dateTime),
    ]
        .filter(Boolean)
        .join(' • ')

    return (
        <PWView style={styles.txRow}>
            <PWView style={styles.txTextBlock}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                >
                    {transaction.merchantName ??
                        t('peraCard.account.transaction_fallback')}
                </PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.txSubtitle}
                    numberOfLines={1}
                >
                    {subtitle}
                </PWText>
            </PWView>
            <CurrencyDisplay
                value={transaction.amountInTransactionCurrency.abs()}
                currency={transaction.transactionCurrency}
                precision={2}
                prefix={isDebit ? '-' : '+'}
                symbolPosition='end'
                variant='bodyLarge'
                weight={500}
                style={isDebit ? styles.txAmountDebit : styles.txAmountCredit}
            />
        </PWView>
    )
}
