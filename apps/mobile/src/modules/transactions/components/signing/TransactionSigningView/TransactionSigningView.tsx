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
import {
    PWButton,
    PWIcon,
    PWText,
    PWTouchableOpacity,
    PWView,
    bottomSheetNotifier,
} from '@components/core'
import {
    type TransactionSignRequest,
    useAlgorandClient,
    useSigningRequest,
    useTransactionEncoder,
} from '@perawallet/wallet-core-blockchain'
import { ScrollView } from 'react-native-gesture-handler'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useTransactionSigner } from '@perawallet/wallet-core-accounts'
import { config } from '@perawallet/wallet-core-config'
import { useSigningNavigation } from './useSigningNavigation'
import { SingleTransactionSummaryView } from './SingleTransactionSummaryView'
import { GroupTransactionListView } from './GroupTransactionListView'
import { MultiGroupListView } from './MultiGroupListView'
import { TransactionDetailsView } from './TransactionDetailsView'
import { SlideView } from './SlideView'

export type TransactionSigningViewProps = {
    request: TransactionSignRequest
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

    const {
        currentView,
        rootViewType,
        isSingleTransaction,
        groups,
        allTransactions,
        totalFee,
        navigateToDetails,
        navigateToGroup,
        navigateToTransaction,
        navigateToInnerTransaction,
        navigateBack,
        canGoBack,
    } = useSigningNavigation({ request })

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

    const renderRootView = () => {
        if (isSingleTransaction) {
            const tx = groups[0]?.[0]
            if (!tx) {
                return (
                    <EmptyView
                        title={t('signing.transaction_view.invalid_title')}
                        body={t('signing.transaction_view.invalid_body')}
                    />
                )
            }
            return (
                <SingleTransactionSummaryView
                    transaction={tx}
                    fee={totalFee}
                    onViewDetails={() => navigateToDetails(tx)}
                />
            )
        }

        if (rootViewType === 'group-list') {
            return (
                <GroupTransactionListView
                    transactions={groups[0] ?? []}
                    fee={totalFee}
                    onTransactionPress={(_, index) =>
                        navigateToTransaction(index, 0)
                    }
                />
            )
        }

        return (
            <MultiGroupListView
                groups={groups}
                fee={totalFee}
                onGroupPress={navigateToGroup}
            />
        )
    }

    const renderSlideView = () => {
        if (!canGoBack) return null

        const { viewType, transaction, groupIndex } = currentView

        if (viewType === 'single-details' && transaction) {
            return (
                <SlideView
                    isVisible={true}
                    style={styles.slideContainer}
                >
                    <ScrollView>
                        <TransactionDetailsView
                            transaction={transaction}
                            onBack={navigateBack}
                            onInnerTransactionPress={navigateToInnerTransaction}
                        />
                    </ScrollView>
                </SlideView>
            )
        }

        if (viewType === 'group-list' && groupIndex !== undefined) {
            const groupTransactions = groups[groupIndex] ?? []
            return (
                <SlideView
                    isVisible={true}
                    style={styles.slideContainer}
                >
                    <ScrollView>
                        <PWTouchableOpacity
                            onPress={navigateBack}
                            style={styles.backButtonRow}
                        >
                            <PWIcon
                                name='chevron-left'
                                size='sm'
                            />
                            <PWText style={styles.backButtonText}>
                                {t('common.go_back.label')}
                            </PWText>
                        </PWTouchableOpacity>
                        <GroupTransactionListView
                            transactions={groupTransactions}
                            fee={groupTransactions.reduce(
                                (sum, tx) => sum + (tx.fee ?? 0n),
                                0n,
                            )}
                            showFee={false}
                            onTransactionPress={(_, index) =>
                                navigateToTransaction(index, groupIndex)
                            }
                        />
                    </ScrollView>
                </SlideView>
            )
        }

        if (viewType === 'transaction-details' && transaction) {
            return (
                <SlideView
                    isVisible={true}
                    style={styles.slideContainer}
                >
                    <ScrollView>
                        <TransactionDetailsView
                            transaction={transaction}
                            onBack={navigateBack}
                            onInnerTransactionPress={navigateToInnerTransaction}
                        />
                    </ScrollView>
                </SlideView>
            )
        }

        return null
    }

    return (
        <PWView style={styles.container}>
            <ScrollView contentContainerStyle={styles.contentContainer}>
                {renderRootView()}
            </ScrollView>

            {renderSlideView()}

            <PWView style={styles.buttonContainer}>
                <PWButton
                    title={t('common.cancel.label')}
                    variant='secondary'
                    onPress={rejectRequest}
                    style={styles.button}
                />
                <PWButton
                    title={
                        allTransactions.length > 1
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
