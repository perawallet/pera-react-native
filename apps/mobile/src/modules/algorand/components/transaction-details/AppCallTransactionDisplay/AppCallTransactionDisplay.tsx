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

import { PWText, PWView } from '@components/core'
import { KeyValueRow } from '@components/KeyValueRow'
import type { AlgorandTransactionView } from '@perawallet/wallet-core-chain-algorand/blockchain'
import { useLanguage } from '@hooks/useLanguage'
import { TransactionDetailCard } from '@modules/signing'
import { ApplicationDisplay } from '@modules/projects'
import { InnerTransactionsPanel } from './InnerTransactionsPanel'
import { AppCallDetailsPanel } from './AppCallDetailsPanel'
import { hasAdvancedAppCallDetails } from './utils'
import { useStyles } from './styles'

export type AppCallTransactionDisplayProps = {
    transaction: AlgorandTransactionView
    onInnerTransactionsPress?: (tx: AlgorandTransactionView) => void
}

const isAppCreation = (tx: AlgorandTransactionView): boolean => {
    return tx.applicationTransaction?.applicationId === BigInt(0)
}

export const AppCallTransactionDisplay = ({
    transaction,
    onInnerTransactionsPress,
}: AppCallTransactionDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const appCall = transaction.applicationTransaction
    if (!appCall) {
        return null
    }

    const appId = appCall.applicationId.toString()
    const hasApplicationRows =
        !isAppCreation(transaction) || !!appCall.onCompletion

    const innerTransactions = transaction.innerTxns ?? []
    const offlineInnerTransactionCount =
        innerTransactions.length === 0
            ? (transaction.innerTransactionCount ?? 0)
            : 0
    const hasExtras =
        innerTransactions.length > 0 ||
        offlineInnerTransactionCount > 0 ||
        hasAdvancedAppCallDetails(transaction)

    return (
        <>
            {hasApplicationRows && (
                <TransactionDetailCard>
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
                </TransactionDetailCard>
            )}

            {hasExtras && (
                <TransactionDetailCard>
                    {offlineInnerTransactionCount > 0 ? (
                        <KeyValueRow
                            title={t(
                                'transactions.app_call.inner_transactions',
                                { count: offlineInnerTransactionCount },
                            )}
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
                </TransactionDetailCard>
            )}
            <AppCallDetailsPanel transaction={transaction} />
        </>
    )
}
