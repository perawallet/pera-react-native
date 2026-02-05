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

import { useCallback } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
    type TransactionSignRequest,
    type TransactionListItem,
} from '@perawallet/wallet-core-signing'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionList'
>

export const useTransactionListScreen = () => {
    const navigation = useNavigation<NavigationProp>()
    const { pendingSignRequests } = useSigningRequest()
    const request = pendingSignRequests[0] as TransactionSignRequest
    const { listItems, totalFee, allTransactions } =
        useSigningRequestAnalysis(request)

    const handleTransactionPress = useCallback(
        (tx: PeraDisplayableTransaction) => {
            navigation.navigate('TransactionDetails', { transaction: tx })
        },
        [navigation],
    )

    const handleGroupPress = useCallback(
        (groupIndex: number) => {
            navigation.navigate('GroupDetail', { groupIndex })
        },
        [navigation],
    )

    const keyExtractor = useCallback(
        (item: TransactionListItem, index: number) => {
            if (item.type === 'group') {
                return `group-${item.groupIndex}`
            }
            return item.transaction.id ?? `tx-${index}`
        },
        [],
    )

    return {
        listItems,
        totalFee,
        transactionCount: allTransactions.length,
        handleTransactionPress,
        handleGroupPress,
        keyExtractor,
    }
}
