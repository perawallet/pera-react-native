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

import { PWListItemLayout, PWText, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { useStyles } from './styles'
import {
    useTransactionListItem,
    type AmountDisplay,
} from './useTransactionListItem'

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
    const { iconType, title, subtitle, amounts, handlePress } =
        useTransactionListItem({
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
            style={styles.container}
            align='top'
            onPress={handlePress}
            left={
                <TransactionIcon
                    type={iconType}
                    size='sm'
                />
            }
            right={
                <PWView style={styles.amountContainer}>
                    {amounts.map((amount, index) => (
                        <CurrencyDisplay
                            key={index}
                            value={amount.value}
                            currency={amount.currency}
                            precision={amount.precision}
                            maxPrecision={2}
                            minPrecision={0}
                            prefix={amount.prefix}
                            showSymbol
                            symbolPosition='end'
                            style={getAmountStyle(amount)}
                            variant='h4'
                        />
                    ))}
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
