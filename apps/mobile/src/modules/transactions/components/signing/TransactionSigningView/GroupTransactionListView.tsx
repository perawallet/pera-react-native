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

import { PWDivider, PWText, PWView } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import {
    microAlgosToAlgos,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { InnerTransactionPreview } from '../../transaction-details/InnerTransactionPreview'

export type GroupTransactionListViewProps = {
    transactions: PeraDisplayableTransaction[]
    groupId?: string
    fee: bigint
    showFee?: boolean
    onTransactionPress: (
        tx: PeraDisplayableTransaction,
        index: number,
    ) => void
}

export const GroupTransactionListView = ({
    transactions,
    groupId,
    fee,
    showFee = true,
    onTransactionPress,
}: GroupTransactionListViewProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    return (
        <PWView style={styles.groupContainer}>
            <PWView style={styles.groupHeader}>
                <TransactionIcon
                    type='group'
                    size='lg'
                />
                <PWText variant='h3'>
                    {t('transactions.group.single_group_title')}
                </PWText>
                {groupId && (
                    <PWText
                        variant='caption'
                        style={styles.groupIdText}
                    >
                        {groupId}
                    </PWText>
                )}
            </PWView>

            <PWDivider color={theme.colors.layerGray} />

            <PWView style={styles.transactionList}>
                <PWText style={styles.transactionListHeaderText}>
                    {t('transactions.group.transactions_count', {
                        count: transactions.length,
                    })}
                </PWText>

                {transactions.map((tx, index) => (
                    <InnerTransactionPreview
                        key={tx.id ?? `tx-${index}`}
                        transaction={tx}
                        onPress={t => onTransactionPress(t, index)}
                    />
                ))}
            </PWView>

            {showFee && (
                <>
                    <PWDivider color={theme.colors.layerGray} />

                    <PWView style={styles.feeRow}>
                        <PWText style={styles.feeLabel}>
                            {t('transactions.common.total_fee')}
                        </PWText>
                        <CurrencyDisplay
                            currency='ALGO'
                            precision={6}
                            minPrecision={2}
                            value={Decimal(microAlgosToAlgos(fee))}
                            showSymbol
                            style={styles.feeValue}
                        />
                    </PWView>
                </>
            )}
        </PWView>
    )
}
