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

import {
    formatISODate,
    formatDisplayDate,
    parseRoundTime,
} from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

export const TRANSACTION_ROW_TYPES = {
    header: 'header',
    transaction: 'transaction',
} as const

export type TransactionDateHeaderRow = {
    kind: typeof TRANSACTION_ROW_TYPES.header
    /** ISO date (`YYYY-MM-DD`) the group covers; also the row key. */
    key: string
    /** Human-readable date title. */
    title: string
}

export type TransactionRow = {
    kind: typeof TRANSACTION_ROW_TYPES.transaction
    /** Transaction id; also the row key. */
    key: string
    transaction: TransactionHistoryItem
}

export type TransactionListRow = TransactionDateHeaderRow | TransactionRow

/**
 * Flattens a transaction history into the alternating date-header / row stream
 * a single-array virtualised list renders.
 *
 * Date groups are emitted newest-first; order within a group is preserved as
 * received, matching how the API returns a page.
 */
export const buildTransactionListRows = (
    transactions: TransactionHistoryItem[],
): TransactionListRow[] => {
    const groups = new Map<string, TransactionHistoryItem[]>()

    for (const transaction of transactions) {
        const dateKey = formatISODate(parseRoundTime(transaction.roundTime))
        const group = groups.get(dateKey)
        if (group) {
            group.push(transaction)
        } else {
            groups.set(dateKey, [transaction])
        }
    }

    const rows: TransactionListRow[] = []

    for (const [dateKey, group] of [...groups.entries()].sort(([a], [b]) =>
        b.localeCompare(a),
    )) {
        rows.push({
            kind: TRANSACTION_ROW_TYPES.header,
            key: dateKey,
            title: formatDisplayDate(dateKey),
        })
        for (const transaction of group) {
            rows.push({
                kind: TRANSACTION_ROW_TYPES.transaction,
                key: transaction.id,
                transaction,
            })
        }
    }

    return rows
}

/**
 * Recycling pool selector. Date headers and transaction rows have very
 * different subtrees, so pooling them together would force a full re-render on
 * every reuse and defeat the point of recycling.
 */
export const getTransactionRowType = (row: TransactionListRow): string =>
    row.kind

export const getTransactionRowKey = (row: TransactionListRow): string =>
    `${row.kind}:${row.key}`
