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
import {
    readAlgorandNative,
    useGroupTransactionsQuery,
    type AlgorandTransactionView,
} from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import type { RootStackParamList } from '@routes/types'

type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'GroupTransactionList'
>
type ScreenRouteProp = RouteProp<RootStackParamList, 'GroupTransactionList'>

export type GroupTransactionListRow = {
    native: TransactionNative
    view: AlgorandTransactionView
}

type UseGroupTransactionListScreenResult = {
    transactions: GroupTransactionListRow[]
    isLoading: boolean
    isError: boolean
    handleTransactionPress: (row: GroupTransactionListRow) => void
    keyExtractor: (item: GroupTransactionListRow, index: number) => string
}

export const useGroupTransactionListScreen =
    (): UseGroupTransactionListScreenResult => {
        const navigation = useNavigation<NavigationProp>()
        const route = useRoute<ScreenRouteProp>()
        const { groupId } = route.params

        const { groupTransactions, isLoading, isError } =
            useGroupTransactionsQuery({ groupId })
        const transactions = useMemo(
            () =>
                groupTransactions.flatMap(native => {
                    const view = readAlgorandNative(native)
                    return view ? [{ native, view }] : []
                }),
            [groupTransactions],
        )

        const handleTransactionPress = useCallback(
            (row: GroupTransactionListRow) => {
                navigation.navigate('TransactionDetails', {
                    transaction: row.native,
                    groupId,
                })
            },
            [navigation, groupId],
        )

        const keyExtractor = useCallback(
            (item: GroupTransactionListRow, index: number) =>
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
