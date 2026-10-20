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

import { useCallback, useMemo } from 'react'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useGroupTransactionsQuery } from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { RootStackParamList } from '@routes/types'
import {
    toGroupTransactionRows,
    type GroupTransactionRow,
} from '../../utils/groupTransactionRows'

type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'GroupTransactionList'
>
type ScreenRouteProp = RouteProp<RootStackParamList, 'GroupTransactionList'>

type UseGroupTransactionListScreenResult = {
    transactions: GroupTransactionRow[]
    isLoading: boolean
    isError: boolean
    handleTransactionPress: (row: GroupTransactionRow) => void
    keyExtractor: (item: GroupTransactionRow, index: number) => string
}

export const useGroupTransactionListScreen =
    (): UseGroupTransactionListScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<ScreenRouteProp>()
        const { groupId } = route.params

        const { groupTransactions, isLoading, isError } =
            useGroupTransactionsQuery({ groupId })
        const transactions = useMemo(
            () => toGroupTransactionRows(groupTransactions),
            [groupTransactions],
        )

        const handleTransactionPress = useCallback(
            (row: GroupTransactionRow) => {
                navigation.navigate('TransactionDetails', {
                    transaction: row.native,
                    groupId,
                })
            },
            [navigation, groupId],
        )

        const keyExtractor = useCallback(
            (item: GroupTransactionRow, index: number) =>
                item.view.id ?? `tx-${index}`,
            [],
        )

        return {
            transactions,
            isLoading,
            isError,
            handleTransactionPress,
            keyExtractor,
        }
    }
