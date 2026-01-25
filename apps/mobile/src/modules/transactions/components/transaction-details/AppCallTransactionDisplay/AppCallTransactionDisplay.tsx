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

import { PWText, PWTouchableOpacity, PWView, PWIcon } from '@components/core'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { InnerTransactionPreview } from '../InnerTransactionPreview'
import { type PeraTransaction } from '@perawallet/wallet-core-blockchain'
import { OnApplicationComplete } from '@algorandfoundation/algokit-utils/transact'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useState } from 'react'

export type AppCallTransactionDisplayProps = {
    transaction: PeraTransaction
    innerTransactions?: PeraTransaction[]
    onInnerTransactionPress?: (tx: PeraTransaction, index: number) => void
}

const getOnCompleteLabel = (onComplete: OnApplicationComplete): string => {
    switch (onComplete) {
        case OnApplicationComplete.NoOp:
            return 'NoOp'
        case OnApplicationComplete.OptIn:
            return 'Opt-In'
        case OnApplicationComplete.CloseOut:
            return 'Close Out'
        case OnApplicationComplete.ClearState:
            return 'Clear State'
        case OnApplicationComplete.UpdateApplication:
            return 'Update'
        case OnApplicationComplete.DeleteApplication:
            return 'Delete'
        default:
            return 'Unknown'
    }
}

const isAppCreation = (tx: PeraTransaction): boolean => {
    return tx.appCall?.appId === BigInt(0)
}

const isAppDeletion = (tx: PeraTransaction): boolean => {
    return tx.appCall?.onComplete === OnApplicationComplete.DeleteApplication
}

const isAppUpdate = (tx: PeraTransaction): boolean => {
    return tx.appCall?.onComplete === OnApplicationComplete.UpdateApplication
}

export const AppCallTransactionDisplay = ({
    transaction,
    innerTransactions = [],
    onInnerTransactionPress,
}: AppCallTransactionDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const [isExpanded, setIsExpanded] = useState(false)

    const appCall = transaction.appCall
    if (!appCall) {
        return null
    }

    const appId = appCall.appId.toString()
    const onComplete = appCall.onComplete
    const hasInnerTransactions = innerTransactions.length > 0

    const getTitleKey = () => {
        if (isAppCreation(transaction)) {
            return 'signing.tx_display.app_call.create_title'
        }
        if (isAppDeletion(transaction)) {
            return 'signing.tx_display.app_call.delete_title'
        }
        if (isAppUpdate(transaction)) {
            return 'signing.tx_display.app_call.update_title'
        }
        return 'signing.tx_display.app_call.title'
    }

    const toggleExpanded = () => {
        setIsExpanded(prev => !prev)
    }

    return (
        <PWView style={styles.container}>
            <TransactionIcon
                type='app-call'
                size='large'
            />
            <PWText variant='h4'>{t(getTitleKey())}</PWText>

            <PWView style={styles.detailsContainer}>
                {!isAppCreation(transaction) && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.app_call.app_id')}
                        </PWText>
                        <PWText style={styles.value}>{appId}</PWText>
                    </PWView>
                )}

                <PWView style={styles.detailRow}>
                    <PWText style={styles.label}>
                        {t('signing.tx_display.app_call.action')}
                    </PWText>
                    <PWText style={styles.value}>
                        {getOnCompleteLabel(onComplete)}
                    </PWText>
                </PWView>

                {appCall.args && appCall.args.length > 0 && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.app_call.args_count')}
                        </PWText>
                        <PWText style={styles.value}>
                            {appCall.args.length}
                        </PWText>
                    </PWView>
                )}

                {appCall.accountReferences &&
                    appCall.accountReferences.length > 0 && (
                        <PWView style={styles.detailRow}>
                            <PWText style={styles.label}>
                                {t('signing.tx_display.app_call.accounts')}
                            </PWText>
                            <PWText style={styles.value}>
                                {appCall.accountReferences.length}
                            </PWText>
                        </PWView>
                    )}

                {appCall.appReferences && appCall.appReferences.length > 0 && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.app_call.foreign_apps')}
                        </PWText>
                        <PWText style={styles.value}>
                            {appCall.appReferences.length}
                        </PWText>
                    </PWView>
                )}

                {appCall.assetReferences &&
                    appCall.assetReferences.length > 0 && (
                        <PWView style={styles.detailRow}>
                            <PWText style={styles.label}>
                                {t(
                                    'signing.tx_display.app_call.foreign_assets',
                                )}
                            </PWText>
                            <PWText style={styles.value}>
                                {appCall.assetReferences.length}
                            </PWText>
                        </PWView>
                    )}

                {appCall.boxReferences && appCall.boxReferences.length > 0 && (
                    <PWView style={styles.detailRow}>
                        <PWText style={styles.label}>
                            {t('signing.tx_display.app_call.boxes')}
                        </PWText>
                        <PWText style={styles.value}>
                            {appCall.boxReferences.length}
                        </PWText>
                    </PWView>
                )}
            </PWView>

            {hasInnerTransactions && (
                <PWView style={styles.innerTransactionsContainer}>
                    <PWTouchableOpacity
                        style={styles.innerTransactionsHeader}
                        onPress={toggleExpanded}
                    >
                        <PWText style={styles.innerTransactionsTitle}>
                            {t(
                                'signing.tx_display.app_call.inner_transactions',
                                {
                                    count: innerTransactions.length,
                                },
                            )}
                        </PWText>
                        <PWIcon
                            name={isExpanded ? 'chevron-down' : 'chevron-right'}
                            size='sm'
                        />
                    </PWTouchableOpacity>

                    {isExpanded && (
                        <PWView style={styles.innerTransactionsList}>
                            {innerTransactions.map((innerTx, index) => (
                                <InnerTransactionPreview
                                    key={`inner-tx-${index}`}
                                    transaction={innerTx}
                                    onPress={() =>
                                        onInnerTransactionPress?.(
                                            innerTx,
                                            index,
                                        )
                                    }
                                />
                            ))}
                        </PWView>
                    )}
                </PWView>
            )}

            {(isAppDeletion(transaction) || isAppUpdate(transaction)) && (
                <PWView style={styles.warningContainer}>
                    <PWText style={styles.warningText}>
                        {isAppDeletion(transaction)
                            ? t('signing.tx_display.app_call.delete_warning')
                            : t('signing.tx_display.app_call.update_warning')}
                    </PWText>
                </PWView>
            )}
        </PWView>
    )
}
