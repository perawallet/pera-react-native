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
import { PWFlatList, PWIcon, PWText, PWToolbar, PWView } from '@components/core'
import { InnerTransactionPreview } from '@modules/transactions/components/transaction-details/InnerTransactionPreview'
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
} from '@perawallet/wallet-core-signing'
import type { SigningStackParamList } from '@modules/signing/routes'
import { GroupListHeader } from './GroupListHeader'
import { GroupListFooter } from './GroupListFooter'
import { useStyles } from './styles'

type NavigationProp = StackNavigationProp<
    SigningStackParamList,
    'GroupList'
>
type GroupListRouteProp = RouteProp<SigningStackParamList, 'GroupList'>

export const GroupListScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const navigation = useNavigation<NavigationProp>()
    const route = useRoute<GroupListRouteProp>()
    const { pendingSignRequests } = useSigningRequest()
    const request = pendingSignRequests[0] as TransactionSignRequest
    const { groups, totalFee } =
        useSigningRequestAnalysis(request)

    const { groupIndex } = route.params
    const transactions = groups[groupIndex] ?? []

    const handleTransactionPress = (tx: PeraDisplayableTransaction) => {
        navigation.navigate('TransactionDetails', { transaction: tx })
    }

    const renderItem = useCallback(
        ({ item }: { item: PeraDisplayableTransaction }) => (
            <InnerTransactionPreview
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
                    <PWText variant='h4' style={styles.title}>
                        {t('signing.transactions.title')}
                    </PWText>
                }
                left={
                    navigation.canGoBack() ? (
                        <PWIcon name='chevron-left' />
                    ) : null
                }
            />
            <GroupListHeader transactionCount={transactions.length} />
            <PWFlatList
                data={transactions}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ItemSeparator}
                contentContainerStyle={styles.contentContainer}
                recycleItems
            />
            <GroupListFooter fee={totalFee} />
        </PWView>
    )
}
