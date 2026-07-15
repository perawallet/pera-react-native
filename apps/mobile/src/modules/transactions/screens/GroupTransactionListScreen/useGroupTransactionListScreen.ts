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

import { useCallback } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
    useGroupTransactionsQuery,
    type PeraDisplayableTransaction,
} from '@perawallet/wallet-core-blockchain'
import type { RootStackParamList } from '@routes/types'

type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'GroupTransactionList'
>
type ScreenRouteProp = RouteProp<RootStackParamList, 'GroupTransactionList'>

type UseGroupTransactionListScreenResult = {
    transactions: PeraDisplayableTransaction[]
    isLoading: boolean
    isError: boolean
    handleTransactionPress: (tx: PeraDisplayableTransaction) => void
    keyExtractor: (item: PeraDisplayableTransaction, index: number) => string
}

export const useGroupTransactionListScreen =
    (): UseGroupTransactionListScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<ScreenRouteProp>()
        const { groupId } = route.params

        const { groupTransactions, isLoading, isError } =
            useGroupTransactionsQuery({ groupId })

        const handleTransactionPress = useCallback(
            (tx: PeraDisplayableTransaction) => {
                navigation.navigate('TransactionDetails', {
                    transaction: tx,
                    groupId,
                })
            },
            [navigation, groupId],
        )

        const keyExtractor = useCallback(
            (item: PeraDisplayableTransaction, index: number) =>
                item.id ?? `tx-${index}`,
            [],
        )

        return {
            transactions: groupTransactions,
            isLoading,
            isError,
            handleTransactionPress,
            keyExtractor,
        }
    }
