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

import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { bytesToHex, toBytes } from '@perawallet/wallet-core-shared'
import { readAlgorandNative, type AlgorandTransactionView } from '../blockchain'
import type {
    GroupTransactionItem,
    RequestStructure,
    SingleTransactionItem,
    TransactionListItem,
} from '@perawallet/wallet-core-signing'

export const algorandViewOf = (
    native: TransactionNative,
): AlgorandTransactionView => {
    const view = readAlgorandNative(native)
    if (!view) {
        throw new Error(
            `The Algorand reviewer was handed a ${native.family} transaction`,
        )
    }
    return view
}

export const createTransactionListItems = (
    transactions: TransactionNative[],
    signableIndices?: ReadonlySet<number>,
): TransactionListItem[] => {
    const items: TransactionListItem[] = []
    const groupMap = new Map<string, GroupTransactionItem>()
    let groupIndex = 0

    const toSingle = (
        native: TransactionNative,
        view: AlgorandTransactionView,
        i: number,
    ): SingleTransactionItem => ({
        type: 'transaction',
        transaction: native,
        id: view.id,
        groupIndex: i,
        isExternal: signableIndices ? !signableIndices.has(i) : false,
    })

    for (let i = 0; i < transactions.length; i++) {
        const native = transactions[i]
        const tx = algorandViewOf(native)
        // A request rehydrated from storage holds its group as a plain object
        // rather than bytes.
        const group = toBytes(tx.group)
        if (group) {
            const groupKey = bytesToHex(group)
            const existingGroup = groupMap.get(groupKey)

            if (existingGroup) {
                existingGroup.transactions.push(toSingle(native, tx, i))
            } else {
                const newGroup: GroupTransactionItem = {
                    type: 'group',
                    transactions: [toSingle(native, tx, i)],
                    groupIndex: groupIndex++,
                    groupId: groupKey,
                }
                groupMap.set(groupKey, newGroup)
                items.push(newGroup)
            }
        } else {
            items.push(toSingle(native, tx, i))
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
