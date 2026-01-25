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
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    encodeAlgorandAddress,
    microAlgosToAlgos,
    type PeraTransaction,
} from '@perawallet/wallet-core-blockchain'
import { truncateAlgorandAddress } from '@perawallet/wallet-core-shared'
import Decimal from 'decimal.js'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'

export type PaymentTransactionDisplayProps = {
    transaction: PeraTransaction
}

export const PaymentTransactionDisplay = ({
    transaction,
}: PaymentTransactionDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const payment = transaction.payment
    if (!payment) {
        return null
    }

    const receiverAddress = encodeAlgorandAddress(payment.receiver.publicKey)
    const amount = microAlgosToAlgos(payment.amount)
    const hasCloseRemainder = payment.closeRemainderTo !== undefined

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type='payment'
                size='large'
            />
            <PWText variant='h4'>
                {t('signing.tx_display.payment.title')}
            </PWText>
            <PWView style={styles.detailRow}>
                <PWText style={styles.label}>
                    {t('signing.tx_display.common.to')}
                </PWText>
                <PWText style={styles.value}>
                    {truncateAlgorandAddress(receiverAddress)}
                </PWText>
            </PWView>
            <CurrencyDisplay
                currency='ALGO'
                precision={6}
                value={Decimal(-amount)}
                showSymbol
                h1
                style={styles.amount}
            />
            {hasCloseRemainder && payment.closeRemainderTo && (
                <PWView style={styles.warningContainer}>
                    <PWText style={styles.warningText}>
                        {t('signing.tx_display.payment.close_warning')}
                    </PWText>
                    <PWText style={styles.warningAddress}>
                        {truncateAlgorandAddress(
                            encodeAlgorandAddress(
                                payment.closeRemainderTo.publicKey,
                            ),
                        )}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
