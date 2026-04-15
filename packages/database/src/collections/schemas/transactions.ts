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

import type { Decimal } from 'decimal.js'

/**
 * Collection definitions for the two transaction-history tables.
 *
 *   - `transactions`          — one row per transaction id per network,
 *                               with the full on-chain detail payload.
 *   - `account_transactions`  — join bridge: one row per (network, account,
 *                               txid) with `roundTime` denormalized.
 *
 * The denormalized `roundTime` on the bridge table is the critical
 * perf move for this migration. The hot path is "fetch the 25 most
 * recent txs for (network, account), optionally older than a cursor" —
 * we pay the cost once at write time (copying `roundTime` alongside the
 * join row) so the read path can sort + limit without chasing into the
 * `transactions` collection at all.
 */

// --- transactions -----------------------------------------------------------

export type TransactionRow = {
    network: string
    id: string
    txType: string
    sender: string
    receiver: string | null
    confirmedRound: number
    roundTime: number
    fee: Decimal
    groupId: string | null
    amount: Decimal | null
    closeTo: string | null
    applicationId: Decimal | null
    innerTransactionCount: number | null
    /**
     * JSON-serialized asset/swap/interpretedMeaning payloads. Parsed at
     * the repository boundary — the database package must not depend on
     * the transaction models defined in `@perawallet/wallet-core-transactions`
     * (would create a cycle).
     */
    assetJson: string | null
    swapGroupDetailJson: string | null
    interpretedMeaningJson: string | null
    updatedAt: number
}

export const TRANSACTIONS_COLLECTION_NAME = 'transactions'
export const TRANSACTIONS_SCHEMA_VERSION = 1

export function transactionsKey(row: {
    network: string
    id: string
}): string {
    return `${row.network}:${row.id}`
}

// --- account_transactions ---------------------------------------------------

export type AccountTransactionRow = {
    network: string
    accountAddress: string
    transactionId: string
    assetId: Decimal | null
    /** Denormalized from `transactions.roundTime` — see header comment. */
    roundTime: number
}

export const ACCOUNT_TRANSACTIONS_COLLECTION_NAME = 'account_transactions'
export const ACCOUNT_TRANSACTIONS_SCHEMA_VERSION = 1

export function accountTransactionsKey(row: {
    network: string
    accountAddress: string
    transactionId: string
}): string {
    return `${row.network}:${row.accountAddress}:${row.transactionId}`
}

/**
 * Prefix used to scan every account_transactions row for one
 * (network, account) pair. Matches the SQL `WHERE network = ? AND
 * accountAddress = ?` pattern used by the pagination query.
 */
export function accountTransactionsPrefix(params: {
    network: string
    accountAddress: string
}): string {
    return `${params.network}:${params.accountAddress}:`
}
