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

import { PWDivider, PWView } from '@components/core'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import {
    microAlgosToAlgos,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import Decimal from 'decimal.js'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { AddressDisplay } from '@components/AddressDisplay'
import { KeyValueRow } from '@components/KeyValueRow'
import { useMemo } from 'react'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { useTheme } from '@rneui/themed'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { ALGO_ASSET } from '@perawallet/wallet-core-assets'
import { DEFAULT_PRECISION } from '@perawallet/wallet-core-shared'

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
    const payment = transaction.paymentTransaction

    const receiverAddress = payment?.receiver
    const senderAddress = transaction.sender
    const amount = useMemo(() => {
        const algos = microAlgosToAlgos(payment?.amount ?? 0n)
        if (senderAddress === referenceAddress) {
            return -algos
        }
        return algos
    }, [senderAddress, payment, receiverAddress])

    const amountStyle = useMemo(() => {
        if (senderAddress === referenceAddress) {
            return styles.amountNegative
        } else if (receiverAddress === referenceAddress) {
            return styles.amountPositive
        }
        return undefined
    }, [amount])

    const showWarnings = useMemo(() => {
        return !transaction?.confirmedRound
    }, [transaction])

    if (!payment) {
        return null
    }

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                <KeyValueRow title={t('transactions.common.amount')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={ALGO_ASSET.decimals}
                        minPrecision={DEFAULT_PRECISION}
                        value={Decimal(amount)}
                        showSymbol
                        style={amountStyle}
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

                <KeyValueRow title={t('transactions.common.fee')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={ALGO_ASSET.decimals}
                        minPrecision={DEFAULT_PRECISION}
                        value={Decimal(
                            microAlgosToAlgos(transaction.fee ?? 0n),
                        )}
                        showSymbol
                    />
                </KeyValueRow>

                <TransactionNoteRow transaction={transaction} />
            </PWView>

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
