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

import { PWDivider, PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionFeeRow } from '../TransactionFeeRow/TransactionFeeRow'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { InnerTransactionsPanel } from './InnerTransactionsPanel'
import { AppCallDetailsPanel } from './AppCallDetailsPanel'
import { ApplicationDisplay } from '@modules/projects/components/ApplicationDisplay'

export type AppCallTransactionDisplayProps = {
    transaction: PeraDisplayableTransaction
    isInnerTransaction?: boolean
    onInnerTransactionsPress?: (tx: PeraDisplayableTransaction) => void
}

const isAppCreation = (tx: PeraDisplayableTransaction): boolean => {
    return tx.applicationTransaction?.applicationId === BigInt(0)
}

export const AppCallTransactionDisplay = ({
    transaction,
    isInnerTransaction = false,
    onInnerTransactionsPress,
}: AppCallTransactionDisplayProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const appCall = transaction.applicationTransaction
    if (!appCall) {
        return null
    }

    const appId = appCall.applicationId.toString()
    const showWarnings = !transaction?.id

    const innerTransactions = transaction.innerTxns ?? []
    const offlineInnerTransactionCount =
        innerTransactions.length === 0
            ? (transaction.innerTransactionCount ?? 0)
            : 0

    return (
        <PWView style={styles.container}>
            <TransactionHeader
                transaction={transaction}
                isInnerTransaction={isInnerTransaction}
            />

            {showWarnings && <TransactionWarnings transaction={transaction} />}

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <PWView style={styles.detailContainer}>
                {!isAppCreation(transaction) && (
                    <KeyValueRow
                        verticalAlignment='top'
                        title={t('transactions.app_call.app_id')}
                    >
                        <PWView style={styles.detailRow}>
                            <ApplicationDisplay
                                applicationId={appId}
                                valueOnlyOnFallback
                            />
                        </PWView>
                    </KeyValueRow>
                )}

                {!!appCall.onCompletion && (
                    <KeyValueRow
                        title={t('transactions.app_call.on_completion')}
                    >
                        <PWText truncate>{appCall.onCompletion}</PWText>
                    </KeyValueRow>
                )}

                <TransactionFeeRow transaction={transaction} />

                <TransactionNoteRow transaction={transaction} />

                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />

                {offlineInnerTransactionCount > 0 ? (
                    <KeyValueRow
                        title={t('transactions.app_call.inner_transactions', {
                            count: offlineInnerTransactionCount,
                        })}
                    >
                        <PWText truncate>
                            {t(
                                'transactions.app_call.inner_transactions_unavailable',
                            )}
                        </PWText>
                    </KeyValueRow>
                ) : (
                    <InnerTransactionsPanel
                        innerTransactions={innerTransactions}
                        onInnerTransactionPress={onInnerTransactionsPress}
                    />
                )}

                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />

                <AppCallDetailsPanel transaction={transaction} />
            </PWView>

            <PWDivider
                style={styles.divider}
                color={theme.colors.layerGray}
            />

            <TransactionFooter transaction={transaction} />
        </PWView>
    )
}
