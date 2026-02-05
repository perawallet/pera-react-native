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
import {
    PWFlatList,
    PWIcon,
    PWText,
    PWToolbar,
    PWTouchableOpacity,
    PWView,
} from '@components/core'
import { TransactionPreview } from '@modules/transactions/components/transaction-details/TransactionPreview'
import { useLanguage } from '@hooks/useLanguage'
import {
    useNavigation,
    useRoute,
    type RouteProp,
} from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import {
    useSigningRequest,
    useSigningRequestAnalysis,
    type TransactionSignRequest,
    type GroupTransactionItem,
} from '@perawallet/wallet-core-signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import { GroupDetailHeader } from './GroupDetailHeader'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<SigningStackParamList, 'GroupDetail'>
type GroupDetailRouteProp = RouteProp<SigningStackParamList, 'GroupDetail'>

export const GroupDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const route = useRoute<GroupDetailRouteProp>()
    const { pendingSignRequests } = useSigningRequest()
    const request = pendingSignRequests[0] as TransactionSignRequest
    const { listItems } = useSigningRequestAnalysis(request)

    const { groupIndex } = route.params
    const groupItem = listItems.find(
        (item): item is GroupTransactionItem =>
            item.type === 'group' && item.groupIndex === groupIndex,
    )
    const transactions = groupItem?.transactions ?? []
    const groupId = groupItem?.transactions.at(0)?.group ?? ''

    const handleTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.navigate('TransactionDetails', { transaction: tx })
    }

    const handleBack = () => {
        navigation.goBack()
    }

    const renderItem = useCallback(
        ({ item }: { item: PeraDisplayableTransaction }) => (
            <TransactionPreview
                transaction={item}
                onPress={() => handleTransactionPress(item)}
            />
        ),
        [handleTransactionPress],
    )

    const keyExtractor = useCallback(
        (item: PeraDisplayableTransaction, index: number) =>
            item.id ?? `tx-${index}`,
        [],
    )

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                center={
                    <PWText
                        variant='h4'
                        style={styles.title}
                    >
                        {t('transactions.group.group_number')}
                    </PWText>
                }
                left={
                    <PWTouchableOpacity onPress={handleBack}>
                        <PWIcon name='chevron-left' />
                    </PWTouchableOpacity>
                }
            />
            <PWView style={styles.contentContainer}>
                <GroupDetailHeader transactionCount={transactions.length} />
                <PWFlatList
                    data={transactions}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    ItemSeparatorComponent={ItemSeparator}
                    contentContainerStyle={styles.listContainer}
                    recycleItems
                />
            </PWView>
        </PWView>
    )
}
