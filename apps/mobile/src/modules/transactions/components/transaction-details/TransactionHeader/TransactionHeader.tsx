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
import {
    getTransactionType,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionStatusBadge } from '../../TransactionStatusBadge'
import { useMemo } from 'react'
import { formatDatetime } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import { TransactionIcon } from '../../TransactionIcon'
import { AddressDisplay } from '@components/AddressDisplay'

export const TransactionHeader = ({
    transaction,
    isInnerTransaction = false,
}: {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
}) => {
    const { t } = useLanguage()
    const styles = useStyles()
    const blockTime = useMemo(
        () =>
            transaction.roundTimeMillis
                ? new Date(transaction.roundTimeMillis)
                : undefined,
        [transaction.roundTimeMillis],
    )

    return (
        <PWView style={styles.container}>
            <PWView style={styles.idContainer}>
                <TransactionIcon
                    size='md'
                    type={getTransactionType(transaction)}
                />
                <PWView style={styles.idTextContainer}>
                    <PWView>
                        <PWText style={styles.blockTitle}>
                            {t(`transactions.type.${transaction.txType}`)}
                        </PWText>
                        {!!transaction.id && (
                            <AddressDisplay
                                address={transaction.id}
                                addressFormat='long'
                                textProps={{ style: styles.addressText }}
                            />
                        )}
                    </PWView>
                    {!isInnerTransaction && (
                        <TransactionStatusBadge
                            status={
                                !transaction.id?.length
                                    ? 'pending'
                                    : 'completed'
                            }
                        />
                    )}
                </PWView>
            </PWView>

            {!!blockTime && !!transaction.confirmedRound && (
                <PWView style={styles.blockContainer}>
                    <PWView style={styles.blockColumn}>
                        <PWText style={styles.blockTitle}>
                            {t('transactions.common.round')}
                        </PWText>
                        <PWText style={styles.blockValue}>
                            {transaction.confirmedRound.toString()}
                        </PWText>
                    </PWView>
                    <PWView style={styles.blockColumn}>
                        <PWText style={styles.blockTitle}>
                            {t('transactions.common.date')}
                        </PWText>
                        <PWText style={styles.blockValue}>
                            {formatDatetime(blockTime, undefined, 'medium')}
                        </PWText>
                    </PWView>
                </PWView>
            )}
        </PWView>
    )
}
