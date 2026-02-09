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
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { GroupDetailHeader } from './GroupDetailHeader'
import { useStyles } from './styles'
import { useGroupDetailScreen } from './useGroupDetailScreen'

export const GroupDetailScreen = () => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { transactions, handleTransactionPress, handleBack, keyExtractor } =
        useGroupDetailScreen()

    const renderItem = useCallback(
        ({ item }: { item: PeraDisplayableTransaction }) => (
            <TransactionPreview
                transaction={item}
                onPress={() => handleTransactionPress(item)}
            />
        ),
        [handleTransactionPress],
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
