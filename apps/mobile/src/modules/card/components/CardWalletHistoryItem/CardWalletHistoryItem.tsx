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

import {
    type CardWalletHistoryEntry,
    TransactionSign,
} from '@perawallet/wallet-core-chain-algorand/card'
import { PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { formatCardTransactionDate } from '../../utils/cardTransactions'
import { useStyles } from './styles'

type CardWalletHistoryItemProps = {
    entry: CardWalletHistoryEntry
}

/** One reward or refund wallet movement; read-only, there is no detail screen. */
export const CardWalletHistoryItem = ({
    entry,
}: CardWalletHistoryItemProps) => {
    const styles = useStyles()
    const isDebit = entry.sign === TransactionSign.Debit
    const isCredit = entry.sign === TransactionSign.Credit

    return (
        <PWView
            style={styles.row}
            testID='card-wallet-history-item'
        >
            <PWView style={styles.textBlock}>
                <PWText
                    variant='bodyLarge'
                    weight={500}
                    numberOfLines={1}
                >
                    {entry.name}
                </PWText>
                <PWText
                    variant='footnoteMedium'
                    weight={400}
                    style={styles.subtitle}
                    numberOfLines={1}
                >
                    {formatCardTransactionDate(entry.dateTime)}
                </PWText>
            </PWView>
            <CurrencyAmount
                value={entry.amount.abs()}
                currency={entry.currency}
                assetId={null}
                precision='compact'
                prefix={isDebit ? '-' : isCredit ? '+' : undefined}
                symbolPosition='end'
                variant='bodyLarge'
                weight={500}
                style={
                    isDebit
                        ? styles.amountDebit
                        : isCredit
                          ? styles.amountCredit
                          : undefined
                }
            />
        </PWView>
    )
}
