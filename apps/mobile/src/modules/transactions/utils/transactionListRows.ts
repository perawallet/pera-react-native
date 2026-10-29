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

import type {
    ChainId,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    formatISODate,
    formatDisplayDate,
    parseRoundTime,
} from '@perawallet/wallet-core-shared'
import type { TransactionHistoryItem } from '@perawallet/wallet-core-transactions'

export const TRANSACTION_ROW_TYPES = {
    header: 'header',
    transaction: 'transaction',
    record: 'record',
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
    /** Set on a list that mixes networks, so the row names its own. */
    networkChainId?: ChainId
}

/** A row on a chain that keeps no cached history rows: already summarised. */
export type TransactionRecordRow = {
    kind: typeof TRANSACTION_ROW_TYPES.record
    /** Transaction id; also the row key. */
    key: string
    record: TransactionRecord
    /** See {@link TransactionRow.networkChainId}. */
    networkChainId?: ChainId
}

export type TransactionEntryRow = TransactionRow | TransactionRecordRow

export type TransactionListRow =
    | TransactionDateHeaderRow
    | TransactionRow
    | TransactionRecordRow

/**
 * Date groups are emitted newest-first; order within a group is preserved as
 * received, matching how the API returns a page.
 */
const groupByDate = <T>(
    entries: T[],
    dateKeyOf: (entry: T) => string,
    toRow: (entry: T) => TransactionRow | TransactionRecordRow,
): TransactionListRow[] => {
    const groups = new Map<string, T[]>()

    for (const entry of entries) {
        const dateKey = dateKeyOf(entry)
        const group = groups.get(dateKey)
        if (group) {
            group.push(entry)
        } else {
            groups.set(dateKey, [entry])
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
        for (const entry of group) {
            rows.push(toRow(entry))
        }
    }

    return rows
}

/**
 * Flattens a transaction history into the alternating date-header / row stream
 * a single-array virtualised list renders.
 */
export const buildTransactionListRows = (
    transactions: TransactionHistoryItem[],
): TransactionListRow[] =>
    groupByDate(
        transactions,
        transaction => formatISODate(parseRoundTime(transaction.roundTime)),
        transaction => ({
            kind: TRANSACTION_ROW_TYPES.transaction,
            key: transaction.id,
            transaction,
        }),
    )

/** {@link buildTransactionListRows} for records; one with no timestamp yet files under today. */
export const buildRecordListRows = (
    records: TransactionRecord[],
): TransactionListRow[] =>
    groupByDate(
        records,
        record => formatISODate(new Date(record.timestamp ?? Date.now())),
        record => ({
            kind: TRANSACTION_ROW_TYPES.record,
            key: record.id,
            record,
        }),
    )

/** Unix ms; a record with no timestamp yet is still in flight, so it sorts above everything. */
export const entryRowTimestampOf = (row: TransactionEntryRow): number =>
    row.kind === TRANSACTION_ROW_TYPES.transaction
        ? parseRoundTime(row.transaction.roundTime).getTime()
        : (row.record.timestamp ?? Number.POSITIVE_INFINITY)

/** Rows from several networks' histories, interleaved newest first under shared date headers. */
export const buildMergedListRows = (
    entries: TransactionEntryRow[],
): TransactionListRow[] => {
    const timed = entries.map(row => ({
        row,
        timestamp: entryRowTimestampOf(row),
    }))
    // Not `b - a`: two in-flight records are both Infinity, and Infinity - Infinity is NaN.
    timed.sort((a, b) =>
        a.timestamp === b.timestamp ? 0 : b.timestamp > a.timestamp ? 1 : -1,
    )
    return groupByDate(
        timed,
        ({ timestamp }) =>
            formatISODate(
                new Date(Number.isFinite(timestamp) ? timestamp : Date.now()),
            ),
        ({ row }) => row,
    )
}

/**
 * Recycling pool selector. Date headers and transaction rows have very
 * different subtrees, so pooling them together would force a full re-render on
 * every reuse and defeat the point of recycling. Record rows render the same
 * list item as transaction rows, so they share its pool.
 */
export const getTransactionRowType = (row: TransactionListRow): string =>
    row.kind === TRANSACTION_ROW_TYPES.header
        ? TRANSACTION_ROW_TYPES.header
        : TRANSACTION_ROW_TYPES.transaction

export const getTransactionRowKey = (row: TransactionListRow): string =>
    `${row.kind}:${row.key}`
