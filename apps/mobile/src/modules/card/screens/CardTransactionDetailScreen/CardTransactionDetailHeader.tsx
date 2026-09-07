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
import { PWText, PWView } from '@components/core'
import { CurrencyAmount } from '@components/CurrencyAmount'
import { useCardTransactionListItem } from '../../components/CardTransactionListItem/useCardTransactionListItem'
import { CardTransactionStatusChip } from './CardTransactionStatusChip'
import { useStyles } from './styles'

type CardTransactionDetailHeaderProps = {
    transaction: CardTransaction
}

export const CardTransactionDetailHeader = ({
    transaction,
}: CardTransactionDetailHeaderProps) => {
    const styles = useStyles()
    // The list-item hook already derives the merchant/deposit title + sign.
    const { title, isDebit } = useCardTransactionListItem(transaction)

    return (
        <PWView style={styles.headerBlock}>
            <PWText
                variant='footnoteMedium'
                style={styles.merchantLabel}
            >
                {title}
            </PWText>
            <CurrencyAmount
                value={transaction.amountInTransactionCurrency.abs()}
                currency={transaction.transactionCurrency}
                precision='compact'
                prefix={isDebit ? '-' : '+'}
                symbolPosition='end'
                variant='h1'
            />
            <CardTransactionStatusChip status={transaction.status} />
        </PWView>
    )
}
