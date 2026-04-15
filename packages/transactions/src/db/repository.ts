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

import { Decimal } from 'decimal.js'
import {
    accountTransactionsKey,
    accountTransactionsPrefix,
    getCollections,
    transactionsKey,
    type AccountTransactionRow,
    type CollectionRegistry,
    type TransactionRow,
} from '@perawallet/wallet-core-database'
import type { TransactionHistoryItem } from '../models/types'

type WithRegistry = { registry?: CollectionRegistry }

function resolveRegistry(
    registry: CollectionRegistry | undefined,
): CollectionRegistry {
    return registry ?? getCollections()
}

function toRow(item: TransactionHistoryItem, network: string): TransactionRow {
    return {
        network,
        id: item.id,
        txType: item.txType,
        sender: item.sender,
        receiver: item.receiver,
        confirmedRound: item.confirmedRound,
        roundTime: item.roundTime,
        fee: item.fee,
        groupId: item.groupId,
        amount: item.amount,
        closeTo: item.closeTo,
        applicationId: item.applicationId
            ? new Decimal(item.applicationId)
            : null,
        innerTransactionCount: item.innerTransactionCount,
        assetJson: item.asset ? JSON.stringify(item.asset) : null,
        swapGroupDetailJson: item.swapGroupDetail
            ? JSON.stringify(item.swapGroupDetail)
            : null,
        interpretedMeaningJson: item.interpretedMeaning
            ? JSON.stringify(item.interpretedMeaning)
            : null,
        updatedAt: Date.now(),
    }
}

function fromRow(row: TransactionRow): TransactionHistoryItem {
    return {
        id: row.id,
        txType: row.txType as TransactionHistoryItem['txType'],
        sender: row.sender,
        receiver: row.receiver,
        confirmedRound: row.confirmedRound,
        roundTime: row.roundTime,
        fee: row.fee,
        groupId: row.groupId,
        amount: row.amount,
        closeTo: row.closeTo,
        applicationId: row.applicationId?.toString() ?? null,
        innerTransactionCount: row.innerTransactionCount,
        asset: row.assetJson ? JSON.parse(row.assetJson) : null,
        swapGroupDetail: row.swapGroupDetailJson
            ? JSON.parse(row.swapGroupDetailJson)
            : null,
        interpretedMeaning: row.interpretedMeaningJson
            ? JSON.parse(row.interpretedMeaningJson)
            : null,
    }
}

function extractAssetIdFromAssetJson(assetJson: string | null): string | null {
    if (!assetJson) return null
    try {
        const parsed = JSON.parse(assetJson) as { assetId?: number | string }
        return parsed.assetId !== undefined ? String(parsed.assetId) : null
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type UpsertTransactionsParams = WithRegistry & {
    items: TransactionHistoryItem[]
    accountAddress: string
    network: string
}

/**
 * Upsert a batch of transactions into both the `transactions` and
 * `account_transactions` collections atomically.
 *
 * The sync service calls this once per sync tick per account; the
 * write volume can be up to several hundred rows. Wrapping the writes
 * in `transact` means:
 *
 *   (a) subscribers see a single commit (one re-render per tick
 *       instead of one per row); and
 *   (b) the adapter flushes a batched `putMany` rather than one
 *       `set` per row.
 */
export async function upsertTransactions({
    registry,
    items,
    accountAddress,
    network,
}: UpsertTransactionsParams): Promise<void> {
    if (items.length === 0) return

    const { transactions, accountTransactions } = resolveRegistry(registry)

    transactions.transact(() => {
        accountTransactions.transact(() => {
            for (const item of items) {
                const txRow = toRow(item, network)
                transactions.upsert(txRow)

                // `account_transactions` uses `onConflictDoNothing` in
                // the SQL version — the bridge row is immutable once
                // written, so re-upserting the same (network, account,
                // txid) tuple is a no-op.
                const bridgeKey = accountTransactionsKey({
                    network,
                    accountAddress,
                    transactionId: item.id,
                })
                if (!accountTransactions.has(bridgeKey)) {
                    const assetIdRaw = extractAssetIdFromAssetJson(
                        txRow.assetJson,
                    )
                    accountTransactions.upsert({
                        network,
                        accountAddress,
                        transactionId: item.id,
                        assetId: assetIdRaw ? new Decimal(assetIdRaw) : null,
                        roundTime: item.roundTime,
                    })
                }
            }
        })
    })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type GetTransactionHistoryParams = WithRegistry & {
    accountAddress: string
    network: string
    assetId?: string
    limit?: number
    beforeRoundTime?: number
}

/**
 * Paginated transaction history for one (network, account).
 *
 * Strategy (matches §3.2 of the migration plan): scan
 * `account_transactions` by prefix, filter by optional assetId and
 * beforeRoundTime cursor, sort descending by `roundTime` (denormalized
 * onto the bridge row so we don't need to chase into `transactions`
 * at sort time), take the top `limit`, then sync-lookup the full row
 * from `transactions` for each of the resulting txids.
 *
 * Cost: O(account_transactions for this account) for the filter,
 * O(filtered-set log filtered-set) for the sort, then O(limit) for
 * the final join. At the expected depth (low thousands of rows per
 * account) this is a sub-millisecond operation after hydration.
 */
export async function getTransactionHistory({
    registry,
    accountAddress,
    network,
    assetId,
    limit = 25,
    beforeRoundTime,
}: GetTransactionHistoryParams): Promise<TransactionHistoryItem[]> {
    const { transactions, accountTransactions } = resolveRegistry(registry)

    const prefix = accountTransactionsPrefix({ network, accountAddress })
    const assetIdStr = assetId

    const candidates: AccountTransactionRow[] = []
    for (const [, bridge] of accountTransactions.entriesWithPrefix(prefix)) {
        if (
            beforeRoundTime !== undefined &&
            bridge.roundTime >= beforeRoundTime
        ) {
            continue
        }
        if (
            assetIdStr !== undefined &&
            (bridge.assetId === null || bridge.assetId.toString() !== assetIdStr)
        ) {
            continue
        }
        candidates.push(bridge)
    }

    candidates.sort((a, b) => b.roundTime - a.roundTime)

    const results: TransactionHistoryItem[] = []
    for (let i = 0; i < candidates.length && results.length < limit; i += 1) {
        const bridge = candidates[i]
        const txRow = transactions.get(
            transactionsKey({ network, id: bridge.transactionId }),
        )
        if (txRow !== undefined) results.push(fromRow(txRow))
    }
    return results
}

type GetLatestTransactionRoundTimeParams = WithRegistry & {
    accountAddress: string
    network: string
}

/**
 * Sync checkpoint: the largest `roundTime` we have persisted for this
 * (network, account). Used by the background sync service to know the
 * cursor to fetch newer transactions from.
 *
 * A single linear scan over the bridge collection's prefix is fine —
 * this is called once per sync tick per account, not per render.
 */
export async function getLatestTransactionRoundTime({
    registry,
    accountAddress,
    network,
}: GetLatestTransactionRoundTimeParams): Promise<number | null> {
    const { accountTransactions } = resolveRegistry(registry)
    const prefix = accountTransactionsPrefix({ network, accountAddress })

    let max: number | null = null
    for (const [, bridge] of accountTransactions.entriesWithPrefix(prefix)) {
        if (max === null || bridge.roundTime > max) max = bridge.roundTime
    }
    return max
}
