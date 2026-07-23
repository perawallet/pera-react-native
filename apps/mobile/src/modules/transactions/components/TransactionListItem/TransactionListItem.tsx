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

import { PWListItemLayout, PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { useLanguage } from '@hooks/useLanguage'
import { useStyles } from './styles'
import { useTransactionListItem } from './useTransactionListItem'
import { type AmountDisplay } from './amounts'

export type TransactionListItemProps = {
    /** The transaction data to display */
    transaction: TransactionHistoryItem
    /** Optional callback when the item is pressed */
    onPress?: (transaction: TransactionHistoryItem) => void
}

export const TransactionListItem = ({
    transaction,
    onPress,
}: TransactionListItemProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const {
        iconType,
        title,
        subtitle,
        amounts,
        amountsOverflowCount,
        handlePress,
    } = useTransactionListItem({
        transaction,
        onPress,
    })

    const getAmountStyle = (amount: AmountDisplay) => {
        if (amount.prefix === '+') return styles.amountPositive
        if (amount.prefix === '-') return styles.amountNegative
        return styles.amount
    }

    return (
        <PWListItemLayout
            testID={`transaction_row_${transaction.id}`}
            style={styles.container}
            align='top'
            onPress={handlePress}
            left={
                <TransactionIcon
                    type={iconType}
                    size='md'
                />
            }
            right={
                <PWView style={styles.amountContainer}>
                    {amounts.map((amount, index) => (
                        <CurrencyAmount
                            key={index}
                            value={amount.value}
                            currency={amount.currency}
                            precision='compact'
                            prefix={amount.prefix}
                            showSymbol
                            symbolPosition='end'
                            style={getAmountStyle(amount)}
                            variant='h4'
                        />
                    ))}
                    {amountsOverflowCount > 0 && (
                        <PWText style={styles.amountOverflow}>
                            {t('transactions.list_item.more_impacts', {
                                count: amountsOverflowCount,
                            })}
                        </PWText>
                    )}
                </PWView>
            }
        >
            <PWView>
                <PWText
                    variant='h4'
                    style={styles.title}
                    truncate
                >
                    {title}
                </PWText>
                {subtitle && (
                    <PWText
                        style={styles.subtitle}
                        truncate
                        ellipsizeMode='middle'
                    >
                        {subtitle}
                    </PWText>
                )}
            </PWView>
        </PWListItemLayout>
    )
}
