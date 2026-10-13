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

import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import type {
    GroupTransactionItem,
    RequestStructure,
    SingleTransactionItem,
    TransactionListItem,
} from '@perawallet/wallet-core-signing'

export const createTransactionListItems = (
    transactions: PeraDisplayableTransaction[],
    signableIndices?: ReadonlySet<number>,
): TransactionListItem[] => {
    const items: TransactionListItem[] = []
    const groupMap = new Map<string, GroupTransactionItem>()
    let groupIndex = 0

    const toSingle = (
        tx: PeraDisplayableTransaction,
        i: number,
    ): SingleTransactionItem => ({
        type: 'transaction',
        transaction: tx,
        groupIndex: i,
        isExternal: signableIndices ? !signableIndices.has(i) : false,
    })

    for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i]
        if (tx.group) {
            const groupKey = encodeToBase64(tx.group)
            const existingGroup = groupMap.get(groupKey)

            if (existingGroup) {
                existingGroup.transactions.push(toSingle(tx, i))
            } else {
                const newGroup: GroupTransactionItem = {
                    type: 'group',
                    transactions: [toSingle(tx, i)],
                    groupIndex: groupIndex++,
                }
                groupMap.set(groupKey, newGroup)
                items.push(newGroup)
            }
        } else {
            items.push(toSingle(tx, i))
        }
    }

    // If there's only one group and no other items, expand it.
    const groupItems = items.filter(item => item.type === 'group')
    if (groupItems.length === 1 && items.length === 1) {
        const group = groupItems[0] as GroupTransactionItem
        return group.transactions
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
