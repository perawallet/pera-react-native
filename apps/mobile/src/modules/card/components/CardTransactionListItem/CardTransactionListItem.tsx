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

import { PWText, PWTouchableOpacity, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import type { CardTransaction } from '@perawallet/wallet-core-card'
import { useCardTransactionListItem } from './useCardTransactionListItem'
import { useStyles } from './styles'

type CardTransactionListItemProps = {
    transaction: CardTransaction
    // Takes the row id so list callers can pass one stable handler instead of
    // a fresh closure per row.
    onPress?: (id: string) => void
}

export const CardTransactionListItem = ({
    transaction,
    onPress,
}: CardTransactionListItemProps) => {
    const styles = useStyles()
    const { title, subtitle, isDebit } = useCardTransactionListItem(transaction)

    const row = (
        <PWView style={styles.txRow}>
            <PWView style={styles.txTextBlock}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                >
                    {title}
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
            <CurrencyAmount
                value={transaction.amountInTransactionCurrency.abs()}
                currency={transaction.transactionCurrency}
                precision='compact'
                prefix={isDebit ? '-' : '+'}
                symbolPosition='end'
                variant='bodyLarge'
                weight={500}
                style={isDebit ? styles.txAmountDebit : styles.txAmountCredit}
            />
        </PWView>
    )

    if (!onPress) return row

    return (
        <PWTouchableOpacity
            onPress={() => onPress(transaction.id)}
            testID={`card_transaction_item_${transaction.id}`}
        >
            {row}
        </PWTouchableOpacity>
    )
}
