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

import { isSameAddress } from '@perawallet/wallet-core-accounts'
import type {
    ChainScope,
    Page,
    PageRef,
    TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    getSubmissionAttemptsWithHistoryEntry,
    type SubmissionAttemptWithHistoryEntry,
    type SubmissionStatus,
} from '@perawallet/wallet-core-signing'
import { getChainCapabilities } from '@perawallet/wallet-core-chain-shared'
import { historyChainAdapters } from './history-adapter'
import type { TransactionHistoryStatus } from './models/types'
import {
    replacementNotNeededNotice,
    transactionStatusNotice,
} from './utils/statusNotice'

/**
 * Ceiling on synthesized pending rows per first-page fetch. Concurrent
 * in-flight groups for one account are a handful at most, so this only caps
 * the pathological case rather than shaping normal output.
 */
export const MAX_PENDING_HISTORY_ROWS = 50

const historyStatusOf = (status: SubmissionStatus): TransactionHistoryStatus =>
    status === 'submitted' || status === 'unknown' ? 'pending' : status

// A failed replacement whose chain of re-priced attempts ends in a confirmed one
// failed only because that transaction landed first.
const isReplacementNotNeeded = (
    attempt: SubmissionAttemptWithHistoryEntry,
    byId: ReadonlyMap<string, SubmissionAttemptWithHistoryEntry>,
): boolean => {
    if (attempt.status !== 'failed') return false
    const visited = new Set<string>([attempt.id])
    let replaced = attempt.replacesAttemptId
    while (replaced !== null && !visited.has(replaced)) {
        visited.add(replaced)
        const ancestor = byId.get(replaced)
        if (!ancestor) return false
        if (ancestor.status === 'confirmed') return true
        replaced = ancestor.replacesAttemptId
    }
    return false
}

export type GetPendingTransactionRecordsParams = {
    address: string
    scope: ChainScope
    /** Ids the chain's history already lists; an attempt sharing any of its txids with them is left out. */
    listedIds: ReadonlySet<string>
}

/**
 * Attempts the wallet broadcast for `address`, as history records, newest
 * first. Reads SQLite only, so it works offline. Resolved attempts
 * (confirmed, failed, replaced) stay until the chain lists them or retention
 * prunes them: the reconciler confirms a send before a cached history page
 * does, and a failed or replaced one is never listed, so it shows until
 * pruned.
 */
export const getPendingTransactionRecords = async ({
    address,
    scope,
    listedIds,
}: GetPendingTransactionRecordsParams): Promise<TransactionRecord[]> => {
    const attempts = await getSubmissionAttemptsWithHistoryEntry({ scope })
    const byId = new Map(attempts.map(attempt => [attempt.id, attempt]))
    const records: TransactionRecord[] = []
    // A transport retry records the same hash twice; newest-first, so the newest status wins.
    const seen = new Set<string>()
    for (const attempt of attempts) {
        const { historyEntry, sender, txIds } = attempt
        if (
            sender === null ||
            !isSameAddress(scope.chainId, sender, address) ||
            txIds.length === 0 ||
            txIds.some(id => listedIds.has(id) || seen.has(id))
        ) {
            continue
        }
        for (const id of txIds) seen.add(id)
        const status = historyStatusOf(attempt.status)
        const notice = isReplacementNotNeeded(attempt, byId)
            ? replacementNotNeededNotice()
            : transactionStatusNotice(status, attempt.createdAt)
        records.push({
            id: txIds[0],
            scope,
            status,
            timestamp: attempt.createdAt,
            fee: historyEntry.fee,
            summary: { ...historyEntry.summary, ...(notice && { notice }) },
            chainData: historyEntry.chainData,
        })
        if (records.length === MAX_PENDING_HISTORY_ROWS) break
    }
    return records
}

// Both lists are newest first; mined order is the backend's and is kept as is.
const mergeNewestFirst = (
    ledger: TransactionRecord[],
    mined: TransactionRecord[],
): TransactionRecord[] => {
    const merged: TransactionRecord[] = []
    let next = 0
    for (const record of mined) {
        while (
            next < ledger.length &&
            ledger[next].timestamp! >= (record.timestamp ?? -Infinity)
        ) {
            merged.push(ledger[next++])
        }
        merged.push(record)
    }
    return [...merged, ...ledger.slice(next)]
}

export type HistoryPageWithPending = Page<TransactionRecord> & {
    /** The chain's own records on this page, before the wallet's sends were merged in. */
    minedItems: TransactionRecord[]
}

/**
 * The chain's history page, with this wallet's own broadcasts merged into
 * page one by time so a send shows before the backend lists it. A rejected mined page
 * rejects; a caller that must render offline reads
 * {@link getPendingTransactionRecords} itself.
 */
export const getTransactionHistoryWithPending = async (
    address: string,
    scope: ChainScope,
    page?: PageRef,
): Promise<HistoryPageWithPending> => {
    const adapter = historyChainAdapters.get(scope.chainId)
    const mined = await adapter.getTransactionHistory(address, scope, page, {
        capabilities: getChainCapabilities(scope.chainId),
    })
    if (page) return { ...mined, minedItems: mined.items }
    const pending = await getPendingTransactionRecords({
        address,
        scope,
        listedIds: new Set(mined.items.map(record => record.id)),
    })
    return {
        ...mined,
        items: mergeNewestFirst(pending, mined.items),
        minedItems: mined.items,
    }
}
