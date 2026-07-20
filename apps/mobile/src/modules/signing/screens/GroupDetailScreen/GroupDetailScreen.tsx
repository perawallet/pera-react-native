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
import { PWFlatList, PWScreen, PWView } from '@components/core'
import { TransactionPreview } from '@modules/transactions/components/transaction-details/TransactionPreview'
import type { SingleTransactionItem } from '@perawallet/wallet-core-signing'
import { GroupDetailHeader } from './GroupDetailHeader'
import { useStyles } from './styles'
import { useGroupDetailScreen } from './useGroupDetailScreen'

export const GroupDetailScreen = () => {
    const styles = useStyles()
    const { transactions, handleTransactionPress, keyExtractor } =
        useGroupDetailScreen()

    const renderItem = useCallback(
        ({ item }: { item: SingleTransactionItem }) => (
            <TransactionPreview
                transaction={item.transaction}
                isExternal={item.isExternal}
                onPress={() => handleTransactionPress(item)}
            />
        ),
        [handleTransactionPress],
    )

    const ItemSeparator = useCallback(
        () => <PWView style={styles.itemSeparator} />,
        [styles.itemSeparator],
    )

    // PWScreen scroll='never' gives the list a fixed full-height body so it
    // can render and own its own in-sheet scrolling — a plain PWView wrapper
    // collapsed the list to zero height (only the header showed).
    return (
        <PWScreen
            scroll='never'
            testID='group_detail_screen'
        >
            <PWFlatList
                data={transactions}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={ItemSeparator}
                ListHeaderComponent={
                    <GroupDetailHeader transactionCount={transactions.length} />
                }
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
        </PWScreen>
    )
}
