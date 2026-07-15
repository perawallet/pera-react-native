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
import type { StackNavigationProp } from '@react-navigation/stack'
import {
    useSigningPipeline,
    type GroupTransactionItem,
    type SingleTransactionItem,
} from '@perawallet/wallet-core-signing'
import type { SigningStackParamList } from '@modules/signing/routes'

type NavigationProp = StackNavigationProp<SigningStackParamList, 'GroupDetail'>
type GroupDetailRouteProp = RouteProp<SigningStackParamList, 'GroupDetail'>

export const useGroupDetailScreen = () => {
    const navigation = useNavigation<NavigationProp>()
    const route = useRoute<GroupDetailRouteProp>()
    const { listItems } = useSigningPipeline()

    const { groupIndex } = route.params
    const groupItem = listItems.find(
        (item): item is GroupTransactionItem =>
            item.type === 'group' && item.groupIndex === groupIndex,
    )
    const transactions: SingleTransactionItem[] = groupItem?.transactions ?? []

    const handleTransactionPress = useCallback(
        (item: SingleTransactionItem) => {
            navigation.navigate('TransactionDetails', {
                transaction: item.transaction,
                isExternal: item.isExternal,
            })
        },
        [navigation],
    )

    const keyExtractor = useCallback(
        (item: SingleTransactionItem, index: number) =>
            item.transaction.id ?? `tx-${index}`,
        [],
    )

    return {
        transactions,
        handleTransactionPress,
        keyExtractor,
    }
}
