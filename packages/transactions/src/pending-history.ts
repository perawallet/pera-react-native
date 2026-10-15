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
    type SubmissionStatus,
} from '@perawallet/wallet-core-signing'
import { historyChainAdapters } from './history-adapter'
import type { TransactionHistoryStatus } from './models/types'
import { transactionStatusNotice } from './utils/statusNotice'

/**
 * Ceiling on synthesized pending rows per first-page fetch. Concurrent
 * in-flight groups for one account are a handful at most, so this only caps
 * the pathological case rather than shaping normal output.
 */
export const MAX_PENDING_HISTORY_ROWS = 50

const historyStatusOf = (status: SubmissionStatus): TransactionHistoryStatus =>
    status === 'submitted' || status === 'unknown' ? 'pending' : status

export type GetPendingTransactionRecordsParams = {
    address: string
    scope: ChainScope
    /** Ids the chain's history already lists; an attempt sharing any of its txids with them is left out. */
    listedIds: ReadonlySet<string>
}

/**
 * Attempts the wallet broadcast for `address`, as history records, newest
 * first. Reads SQLite only, so it works offline. Confirmed attempts stay
 * until the chain lists them or retention prunes them: the reconciler
 * confirms a send before a cached history page does.
 */
export const getPendingTransactionRecords = async ({
    address,
    scope,
    listedIds,
}: GetPendingTransactionRecordsParams): Promise<TransactionRecord[]> => {
    const attempts = await getSubmissionAttemptsWithHistoryEntry({ scope })
    const records: TransactionRecord[] = []
    // A transport retry records the same hash twice; newest-first, so the newest status wins.
    const seen = new Set<string>()
    for (const attempt of attempts) {
        const { historyEntry, sender, txIds } = attempt
        if (
            historyEntry === null ||
            sender === null ||
            !isSameAddress(scope.chainId, sender, address) ||
            txIds.length === 0 ||
            txIds.some(id => listedIds.has(id) || seen.has(id))
        ) {
            continue
        }
        for (const id of txIds) seen.add(id)
        const status = historyStatusOf(attempt.status)
        const notice = transactionStatusNotice(status, attempt.createdAt)
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

/**
 * The chain's history page, with this wallet's own broadcasts ahead of page
 * one so a send shows before the backend lists it. A rejected mined page
 * rejects; a caller that must render offline reads
 * {@link getPendingTransactionRecords} itself.
 */
export const getTransactionHistoryWithPending = async (
    address: string,
    scope: ChainScope,
    page?: PageRef,
): Promise<Page<TransactionRecord>> => {
    const adapter = historyChainAdapters.get(scope.chainId)
    const mined = await adapter.getTransactionHistory(address, scope, page)
    if (page) return mined
    const pending = await getPendingTransactionRecords({
        address,
        scope,
        listedIds: new Set(mined.items.map(record => record.id)),
    })
    return { ...mined, items: [...pending, ...mined.items] }
}
