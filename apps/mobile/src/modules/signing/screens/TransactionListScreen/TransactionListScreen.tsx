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
import { PWFlatList, PWScreen } from '@components/core'
import type { TransactionListItem } from '@perawallet/wallet-core-signing'
import { TransactionListHeader } from './TransactionListHeader'
import { TransactionListFooter } from './TransactionListFooter'
import { GroupPreviewItem } from './GroupPreviewItem'
import { useTransactionListScreen } from './useTransactionListScreen'
import { TransactionPreview } from '@modules/transactions/components/transaction-details'

export const TransactionListScreen = () => {
    const {
        listItems,
        transactionCount,
        sourceMetadata,
        verifiedOrigin,
        handleTransactionPress,
        handleGroupPress,
        keyExtractor,
    } = useTransactionListScreen()

    const renderItem = useCallback(
        ({ item }: { item: TransactionListItem }) => {
            if (item.type === 'group') {
                return (
                    <GroupPreviewItem
                        transactions={item.transactions}
                        onPress={() => handleGroupPress(item.groupIndex)}
                    />
                )
            }

            return (
                <TransactionPreview
                    transaction={item.transaction}
                    isExternal={item.isExternal}
                    onPress={() => handleTransactionPress(item)}
                />
            )
        },
        [handleTransactionPress, handleGroupPress],
    )

    return (
        <PWScreen
            scroll='never'
            footer={<TransactionListFooter />}
        >
            <PWFlatList
                cardLayout
                data={listItems}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                ListHeaderComponent={
                    <TransactionListHeader
                        itemCount={transactionCount}
                        sourceMetadata={sourceMetadata}
                        verifiedOrigin={verifiedOrigin}
                    />
                }
                showsVerticalScrollIndicator={false}
                inBottomSheet
            />
        </PWScreen>
    )
}
