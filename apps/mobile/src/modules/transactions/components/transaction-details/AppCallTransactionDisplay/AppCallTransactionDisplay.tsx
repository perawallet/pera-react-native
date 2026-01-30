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
import { KeyValueRow } from '@components/KeyValueRow'
import {
    microAlgosToAlgos,
    PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useTheme } from '@rneui/themed'
import { TransactionHeader } from '../TransactionHeader/TransactionHeader'
import { TransactionNoteRow } from '../TransactionNoteRow/TransactionNoteRow'
import { TransactionWarnings } from '../../TransactionWarnings/TransactionWarnings'
import { TransactionFooter } from '../TransactionFooter/TransactionFooter'
import { CurrencyDisplay } from '@components/CurrencyDisplay'
import Decimal from 'decimal.js'
import { TitledExpandablePanel } from '@components/ExpandablePanel/TitledExpandablePanel'
import { InnerTransactionPreview } from '../InnerTransactionPreview'

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
    const hasInnerTransactions = !!transaction.innerTxns?.length
    const innerTransactionCount = transaction.innerTxns?.length ?? 0
    const showWarnings = !transaction?.id
    const hasAdvancedDetails =
        !!appCall.applicationArgs?.length ||
        !!appCall.accounts?.length ||
        !!appCall.foreignApps?.length ||
        !!appCall.foreignAssets?.length

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
                {!isAppCreation(transaction) && (
                    <KeyValueRow title={t('transactions.app_call.app_id')}>
                        <PWText>#{appId}</PWText>
                    </KeyValueRow>
                )}

                <KeyValueRow title={t('transactions.app_call.on_completion')}>
                    <PWText>{appCall.onCompletion}</PWText>
                </KeyValueRow>

                <KeyValueRow title={t('transactions.common.fee')}>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={6}
                        minPrecision={2}
                        value={Decimal(
                            microAlgosToAlgos(transaction.fee ?? 0n),
                        )}
                        showSymbol
                    />
                </KeyValueRow>

                <TransactionNoteRow transaction={transaction} />

                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />

                {hasInnerTransactions && (
                    <TitledExpandablePanel
                        title={t('transactions.app_call.inner_transactions', {
                            count: innerTransactionCount,
                        })}
                    >
                        <PWView style={styles.expandablePanel}>
                            {transaction.innerTxns?.map((tx, index) => (
                                <InnerTransactionPreview
                                    onPress={onInnerTransactionsPress}
                                    key={tx.id ?? index}
                                    transaction={tx}
                                />
                            ))}
                        </PWView>
                    </TitledExpandablePanel>
                )}

                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />

                {hasAdvancedDetails && (
                    <TitledExpandablePanel
                        title={t('transactions.app_call.details')}
                    >
                        <PWView style={styles.expandablePanel}>
                            {appCall.applicationArgs &&
                                appCall.applicationArgs.length > 0 && (
                                    <KeyValueRow
                                        title={t(
                                            'transactions.app_call.args_count',
                                        )}
                                    >
                                        <PWText style={styles.detailText}>
                                            {appCall.applicationArgs.length}
                                        </PWText>
                                    </KeyValueRow>
                                )}

                            {appCall.accounts &&
                                appCall.accounts.length > 0 && (
                                    <KeyValueRow
                                        verticalAlignment='top'
                                        title={t(
                                            'transactions.app_call.accounts',
                                        )}
                                    >
                                        {appCall.accounts.map(account => (
                                            <PWText
                                                key={
                                                    'account-' +
                                                    account.toString()
                                                }
                                                style={styles.detailText}
                                            >
                                                {account.toString()}
                                            </PWText>
                                        ))}
                                    </KeyValueRow>
                                )}

                            {appCall.foreignApps &&
                                appCall.foreignApps.length > 0 && (
                                    <KeyValueRow
                                        verticalAlignment='top'
                                        title={t(
                                            'transactions.app_call.foreign_apps',
                                        )}
                                    >
                                        {appCall.foreignApps.map(appId => (
                                            <PWText
                                                key={
                                                    'foreign-app-' +
                                                    appId.toString()
                                                }
                                                style={styles.detailText}
                                            >
                                                {appId.toString()}
                                            </PWText>
                                        ))}
                                    </KeyValueRow>
                                )}

                            {appCall.foreignAssets &&
                                appCall.foreignAssets.length > 0 && (
                                    <KeyValueRow
                                        verticalAlignment='top'
                                        title={t(
                                            'transactions.app_call.foreign_assets',
                                        )}
                                    >
                                        {appCall.foreignAssets.map(assetId => (
                                            <PWText
                                                key={
                                                    'foreign-asset-' +
                                                    assetId.toString()
                                                }
                                                style={styles.detailText}
                                            >
                                                {assetId.toString()}
                                            </PWText>
                                        ))}
                                    </KeyValueRow>
                                )}

                            {appCall.boxReferences &&
                                appCall.boxReferences.length > 0 && (
                                    <KeyValueRow
                                        title={t('transactions.app_call.boxes')}
                                    >
                                        <PWText style={styles.detailText}>
                                            {appCall.boxReferences.length}
                                        </PWText>
                                    </KeyValueRow>
                                )}
                        </PWView>
                    </TitledExpandablePanel>
                )}
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
