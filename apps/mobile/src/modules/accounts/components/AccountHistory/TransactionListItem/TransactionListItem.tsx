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

import { PWIcon, PWText, PWTouchableOpacity, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'
import { useStyles } from './styles'
import { useTransactionListItem } from './useTransactionListItem'

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

    return (
        <PWTouchableOpacity
            style={styles.container}
            onPress={handlePress}
        >
            <PWView style={styles.iconContainer}>
                <TransactionIcon
                    type={iconType}
                    size='md'
                />
            </PWView>

            <PWView style={styles.contentContainer}>
                <PWView style={styles.mainRow}>
                    <PWView style={styles.titleContainer}>
                        <PWText
                            variant='h4'
                            style={styles.title}
                            numberOfLines={1}
                        >
                            {title}
                        </PWText>
                        {subtitle && (
                            <PWText
                                style={styles.subtitle}
                                numberOfLines={1}
                            >
                                {subtitle}
                            </PWText>
                        )}
                    </PWView>

                    <PWView style={styles.amountContainer}>
                        {amounts.map(
                            (
                                amount: {
                                    text: string
                                    isPositive: boolean
                                    isNegative: boolean
                                    hasAlgoIcon?: boolean
                                },
                                index: number,
                            ) => (
                                <PWView
                                    key={index}
                                    style={styles.amountRow}
                                >
                                    {amount.hasAlgoIcon && (
                                        <PWIcon
                                            name='algo'
                                            size='sm'
                                            variant={
                                                amount.isPositive
                                                    ? 'positive'
                                                    : amount.isNegative
                                                      ? 'error'
                                                      : 'primary'
                                            }
                                        />
                                    )}
                                    <PWText
                                        style={[
                                            styles.amount,
                                            amount.isPositive &&
                                                styles.amountPositive,
                                            amount.isNegative &&
                                                styles.amountNegative,
                                        ]}
                                    >
                                        {amount.text}
                                    </PWText>
                                </PWView>
                            ),
                        )}
                    </PWView>
                </PWView>
            </PWView>
        </PWTouchableOpacity>
    )
}
