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

export type RequestStructure = 'single' | 'list'

/**
 * Represents a single transaction item in the list
 */
export type SingleTransactionItem = {
    type: 'transaction'
    transaction: PeraDisplayableTransaction
}

/**
 * Represents a group of transactions in the list
 */
export type GroupTransactionItem = {
    type: 'group'
    transactions: PeraDisplayableTransaction[]
    groupIndex: number
}

/**
 * Union type for items that can appear in the transaction list
 */
export type TransactionListItem = SingleTransactionItem | GroupTransactionItem

/**
 * Classifies the request structure based on the transaction groups
 * - 'single': One transaction alone (or empty/invalid) - shows SingleTransactionScreen
 * - 'list': Multiple items (transactions and/or groups) - shows TransactionListScreen
 */
export const classifyTransactionGroups = (
    groups: PeraDisplayableTransaction[][],
): RequestStructure => {
    // Empty groups or single transaction = single view
    if (groups.length === 0) return 'single'
    if (groups.length === 1 && groups[0]?.length === 1) return 'single'
    return 'list'
}

/**
 * Converts the grouped transactions into a flat list of items for display.
 * - Groups with a single transaction without a group ID are shown as individual transactions
 * - Groups with multiple transactions or a group ID are shown as group items
 */
export const createTransactionListItems = (
    groups: PeraDisplayableTransaction[][],
): TransactionListItem[] => {
    const items: TransactionListItem[] = []

    groups.forEach((group, index) => {
        // A group is shown as a "group item" if:
        // 1. It has more than 1 transaction, OR
        // 2. The single transaction has a group ID (meaning it's part of a group)
        const isActualGroup =
            group.length > 1 || (group.length === 1 && !!group[0]?.group)

        if (isActualGroup) {
            items.push({
                type: 'group',
                transactions: group,
                groupIndex: index,
            })
        } else if (group.length === 1) {
            // Single transaction without group ID - show as individual
            items.push({
                type: 'transaction',
                transaction: group[0]!,
            })
        }
    })

    return items
}
