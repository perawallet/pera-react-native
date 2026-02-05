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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

export type RequestStructure = 'single' | 'list'

export type SingleTransactionItem = {
    type: 'transaction'
    transaction: PeraDisplayableTransaction
}

export type GroupTransactionItem = {
    type: 'group'
    transactions: PeraDisplayableTransaction[]
    groupIndex: number
}

export type TransactionListItem = SingleTransactionItem | GroupTransactionItem

export const createTransactionListItems = (
    transactions: PeraDisplayableTransaction[],
): TransactionListItem[] => {
    const items: TransactionListItem[] = []
    const groupMap = new Map<string, GroupTransactionItem>()
    let groupIndex = 0

    for (const tx of transactions) {
        if (tx.group) {
            const groupKey = encodeToBase64(tx.group)
            const existingGroup = groupMap.get(groupKey)

            if (existingGroup) {
                // Add to existing group (already in items array)
                existingGroup.transactions.push(tx)
            } else {
                // Create new group at this position
                const newGroup: GroupTransactionItem = {
                    type: 'group',
                    transactions: [tx],
                    groupIndex: groupIndex++,
                }
                groupMap.set(groupKey, newGroup)
                items.push(newGroup)
            }
        } else {
            // Ungrouped transaction
            items.push({
                type: 'transaction',
                transaction: tx,
            })
        }
    }

    // If there's only one group and no other items, expand it
    const groupItems = items.filter(item => item.type === 'group')
    if (groupItems.length === 1 && items.length === 1) {
        const group = groupItems[0] as GroupTransactionItem
        return group.transactions.map(tx => ({
            type: 'transaction' as const,
            transaction: tx,
        }))
    }

    return items
}

export const classifyRequestStructure = (
    listItems: TransactionListItem[],
): RequestStructure => {
    if (listItems.length === 0) return 'single'
    if (listItems.length === 1 && listItems[0]?.type === 'transaction')
        return 'single'
    return 'list'
}
