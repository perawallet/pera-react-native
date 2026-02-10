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

import { ScrollView } from 'react-native-gesture-handler'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'

import { PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import { LoadingView } from '@components/LoadingView'
import { EmptyView } from '@components/EmptyView'
import { useLanguage } from '@hooks/useLanguage'
import {
    useTransactionDetailQuery,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import { TransactionDisplay } from '@modules/transactions/components/TransactionDisplay'
import type { SigningStackParamList } from '@modules/signing/routes'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionDetails'
>

type TransactionDetailsRouteProp = RouteProp<
    SigningStackParamList,
    'TransactionDetails'
>

export const TransactionDetailsScreen = () => {
    const styles = useStyles()
    const navigation = useNavigation<NavigationProp>()
    const route = useRoute<TransactionDetailsRouteProp>()

    const { transaction: paramTransaction, transactionId } = route.params

    const { data: fetchedTransaction, isLoading } = useTransactionDetailQuery({
        transactionId: transactionId || paramTransaction?.id || '',
        isEnabled: !paramTransaction && !!transactionId,
    })

    const transaction = paramTransaction || fetchedTransaction || null

    const handleInnerTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.push('TransactionDetails', { transaction: tx })
    }

    const renderContent = () => {
        if (transaction) {
            return (
                <ScrollView contentContainerStyle={styles.contentContainer}>
                    <TransactionDisplay
                        transaction={transaction}
                        onInnerTransactionsPress={handleInnerTransactionPress}
                    />
                </ScrollView>
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

    return (
        <ScrollView contentContainerStyle={styles.contentContainer}>
            <TransactionDisplay
                transaction={transaction}
                onInnerTransactionsPress={handleInnerTransactionPress}
            />
            {renderContent()}
        </ScrollView>
    )
}
