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

import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import { PWScreen } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import {
    useTransactionDetailQuery,
    useGroupTransactionsQuery,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { TransactionDisplay } from '@modules/transactions/components/TransactionDisplay'
import { GroupTransactionsPanel } from '@modules/transactions/components/transaction-details'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRouteProp = RouteProp<
    SigningStackParamList,
    'TransactionDetails'
>

export const TransactionDetailsScreen = () => {
    const navigation = useNavigation<NavigationProp>()
    const { t } = useLanguage()
    const route = useRoute<TransactionDetailsRouteProp>()

    const {
        transaction: paramTransaction,
        transactionId,
        groupId,
    } = route.params

    const { data: fetchedTransaction, isLoading } = useTransactionDetailQuery({
        transactionId: transactionId || paramTransaction?.id || '',
        isEnabled: !paramTransaction && !!transactionId,
    })

    const { groupTransactions } = useGroupTransactionsQuery({
        groupId,
    })

    const transaction = paramTransaction || fetchedTransaction || null

    const handleInnerTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.push('TransactionDetails', { transaction: tx, groupId })
    }

    const handleGroupTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.push('TransactionDetails', { transaction: tx, groupId })
    }

    if (transaction) {
        return (
            <PWScreen
                keyboard='none'
                horizontalPadding='xl'
            >
                <TransactionDisplay
                    transaction={transaction}
                    onInnerTransactionsPress={handleInnerTransactionPress}
                />
                {groupTransactions.length > 1 && (
                    <GroupTransactionsPanel
                        groupTransactions={groupTransactions}
                        currentTransactionId={
                            transaction.id ?? transactionId ?? ''
                        }
                        onGroupTransactionPress={handleGroupTransactionPress}
                    />
                )}
            </PWScreen>
        )
    }

    if (isLoading) {
        return (
            <LoadingView
                variant='circle'
                size='lg'
            />
        )
    }

    return (
        <EmptyView
            title={t('errors.general.title')}
            body={t('errors.general.body')}
        />
    )
}
