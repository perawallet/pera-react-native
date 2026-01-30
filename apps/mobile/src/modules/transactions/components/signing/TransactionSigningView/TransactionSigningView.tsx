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

import { EmptyView } from '@components/EmptyView'
import { TransactionIcon } from '@modules/transactions/components/TransactionIcon'
import { PWButton, PWText, PWView, bottomSheetNotifier } from '@components/core'
import {
    type TransactionSignRequest,
    useAlgorandClient,
    useSigningRequest,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { ScrollView } from 'react-native-gesture-handler'
import { useStyles } from './styles'
import { BalanceImpactView } from '../BalanceImpactView/BalanceImpactView'
import { TransactionDisplay } from '../../TransactionDisplay'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useTransactionSigner } from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { useSingleTransactionView } from './useSingleTransactionView'
import { useGroupTransactionView } from './useGroupTransactionView'

export type TransactionSigningViewProps = {
    request: TransactionSignRequest
}

const SingleTransactionView = ({ request }: TransactionSigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        rootTx,
        currentTx,
        isViewingInnerTransaction,
        handleNavigateToInner,
        handleNavigateBack,
    } = useSingleTransactionView({ request })

    if (!rootTx || !currentTx) {
        return (
            <EmptyView
                title={t('signing.transaction_view.invalid_title')}
                body={t('signing.transaction_view.invalid_body')}
            />
        )
    }

    return (
        <PWView style={styles.body}>
            {isViewingInnerTransaction && (
                <PWButton
                    title={t('common.go_back.label')}
                    variant='secondary'
                    onPress={handleNavigateBack}
                    style={styles.backButton}
                />
            )}
            <TransactionDisplay transaction={currentTx} onInnerTransactionsPress={handleNavigateToInner} />
        </PWView>
    )
}

const GroupTransactionView = ({ request }: TransactionSigningViewProps) => {
    const styles = useStyles()
    const { t } = useLanguage()

    const {
        isMultipleGroups,
        allTransactions,
        currentTx,
        isViewingTransaction,
        handleSelectTransaction,
        handleNavigateToInner,
        handleNavigateBack,
    } = useGroupTransactionView({ request })

    if (isViewingTransaction && currentTx) {
        return (
            <ScrollView contentContainerStyle={styles.body}>
                <PWButton
                    title={t('common.go_back.label')}
                    variant='secondary'
                    onPress={handleNavigateBack}
                    style={styles.backButton}
                />
                <TransactionDisplay transaction={currentTx} onInnerTransactionsPress={handleNavigateToInner} />
            </ScrollView>
        )
    }

    return (
        <ScrollView contentContainerStyle={styles.body}>
            <TransactionIcon
                type='group'
                size='lg'
            />
            <PWText variant='h4'>
                {isMultipleGroups
                    ? t('signing.tx_display.group.multiple_groups_title')
                    : t('signing.tx_display.group.single_group_title')}
            </PWText>

            <PWView style={styles.transactionListContainer}>
                <PWText style={styles.transactionListHeader}>
                    {t('signing.tx_display.group.transactions_count', {
                        count: allTransactions.length,
                    })}
                </PWText>

                {allTransactions.map((tx, index) => (
                    <PWButton
                        key={`tx-${index}`}
                        title={`${index + 1}. ${tx.txType}`}
                        variant='secondary'
                        onPress={() => handleSelectTransaction(index)}
                        style={styles.transactionListItem}
                    />
                ))}
            </PWView>

            <BalanceImpactView />
        </ScrollView>
    )
}

export const TransactionSigningView = ({
    request,
}: TransactionSigningViewProps) => {
    const styles = useStyles()
    const { removeSignRequest } = useSigningRequest()
    const { signTransactions } = useTransactionSigner()
    const { encodeSignedTransactions } = useTransactionEncoder()
    const algokit = useAlgorandClient()
    const { showToast } = useToast()
    const { t } = useLanguage()
    const isMultipleTransactions = request.txs?.length > 1

    const signAndSend = async () => {
        try {
            const signedTxs = await Promise.all(
                request.txs.map(txs => {
                    return signTransactions(
                        txs,
                        request.txs.map((_, idx) => idx),
                    )
                }),
            )
            if (request.transport === 'algod') {
                signedTxs.forEach(group => {
                    algokit.client.algod.sendRawTransaction(
                        encodeSignedTransactions(group),
                    )
                })
            } else {
                await request.approve?.(signedTxs)
                showToast({
                    title: t('signing.transaction_view.success_title'),
                    body: t('signing.transaction_view.success_body'),
                    type: 'success',
                })
            }
            removeSignRequest(request)
        } catch (error) {
            if (request.transport === 'algod') {
                showToast(
                    {
                        type: 'error',
                        title: t(
                            'signing.transaction_view.transaction_failed_title',
                        ),
                        body: config.debugEnabled
                            ? `${error}`
                            : t(
                                'signing.transaction_view.transaction_failed_body',
                            ),
                    },
                    {
                        notifier: bottomSheetNotifier.current ?? undefined,
                    },
                )
            } else {
                request.error?.(`${error}`)
            }
        }
    }

    const rejectRequest = () => {
        if (request.transport === 'callback') {
            request.reject?.()
        }
        removeSignRequest(request)
    }

    return (
        <PWView style={styles.container}>
            {isMultipleTransactions ? (
                <GroupTransactionView request={request} />
            ) : (
                <SingleTransactionView request={request} />
            )}
            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('common.cancel.label')}
                    variant='secondary'
                    onPress={rejectRequest}
                    style={styles.button}
                />
                <PWButton
                    title={
                        isMultipleTransactions
                            ? t('common.confirm_all.label')
                            : t('common.confirm.label')
                    }
                    variant='primary'
                    onPress={signAndSend}
                    style={styles.button}
                />
            </PWView>
        </PWView>
    )
}
