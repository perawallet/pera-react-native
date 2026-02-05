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

import { useCallback, useMemo } from 'react'
import { PWFlatList, PWText, PWToolbar, PWView } from '@components/core'
import { InnerTransactionPreview } from '@modules/transactions/components/transaction-details/InnerTransactionPreview'
import { useLanguage } from '@hooks/useLanguage'
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
import { TransactionListHeader } from './TransactionListHeader'
import { TransactionListFooter } from './TransactionListFooter'
import { GroupPreviewItem } from './GroupPreviewItem'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'TransactionList'
>

export const TransactionListScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const { pendingSignRequests } = useSigningRequest()
    const request = pendingSignRequests[0] as TransactionSignRequest
    const { listItems, totalFee, allTransactions } =
        useSigningRequestAnalysis(request)

    const handleTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.navigate('TransactionDetails', { transaction: tx })
    }

    const handleGroupPress = (groupIndex: number) => {
        navigation.navigate('GroupDetail', { groupIndex })
    }

    const renderItem = useCallback(
        ({ item }: { item: TransactionListItem }) => {
            if (item.type === 'group') {
                return (
                    <GroupPreviewItem
                        transactions={item.transactions}
                        groupIndex={item.groupIndex}
                        onPress={() => handleGroupPress(item.groupIndex)}
                    />
                )
            }

            return (
                <InnerTransactionPreview
                    transaction={item.transaction}
                    onPress={() => handleTransactionPress(item.transaction)}
                />
            )
        },
        [handleTransactionPress, handleGroupPress],
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

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    const ListHeader = useMemo(
        () => <TransactionListHeader itemCount={allTransactions.length} />,
        [allTransactions.length],
    )

    const ListFooter = useMemo(
        () => <TransactionListFooter totalFee={totalFee} />,
        [totalFee],
    )

    return (
        <PWView style={styles.container}>
            <PWToolbar
                center={
                    <PWText variant='h4'>
                        {t('signing.transactions.title')}
                    </PWText>
                }
            />
            <PWFlatList
                data={listItems}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ItemSeparator}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                contentContainerStyle={styles.contentContainer}
            />
        </PWView>
    )
}
