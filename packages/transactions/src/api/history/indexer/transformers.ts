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

import { logger } from '@perawallet/wallet-core-shared'
import { computeBalanceImpacts } from './balance-impacts'
import {
    indexerTransactionSchema,
    indexerTransactionsResponseSchema,
    type IndexerTransaction,
    type IndexerTransactionNode,
} from './schema'
import type {
    TransactionHistoryApiResponse,
    TransactionHistoryItemApiResponse,
} from '../schema'

const ALGO_ASSET_KEY = '0'
const ALGO_UNIT_NAME = 'ALGO'
const ALGO_DECIMALS = 6

/** Asset display facts, resolved from the real chain's indexer by the caller. */
export type AssetLookup = Map<
    string,
    { name?: string; unitName?: string; decimals?: number }
>

/**
 * Round/timestamp fields only — never used for amounts. Real round numbers
 * and unix timestamps sit many orders of magnitude below 2^53, so routing
 * them through `Number()` (unlike amount fields) is safe.
 */
const toNumber = (value: number | string | bigint | undefined): number =>
    typeof value === 'number' ? value : Number(value ?? 0)

const toAmountString = (value: number | string | bigint | undefined): string =>
    value === undefined ? '0' : BigInt(value).toString()

const receiverOf = (tx: IndexerTransaction): string | undefined =>
    tx['payment-transaction']?.receiver ??
    tx['asset-transfer-transaction']?.receiver

const amountOf = (tx: IndexerTransaction): string | undefined => {
    const payment = tx['payment-transaction']
    if (payment) return toAmountString(payment.amount)
    const transfer = tx['asset-transfer-transaction']
    if (transfer) return toAmountString(transfer.amount)
    return undefined
}

const closeToOf = (tx: IndexerTransaction): string | undefined =>
    tx['payment-transaction']?.['close-remainder-to'] ??
    tx['asset-transfer-transaction']?.['close-to']

const closeAmountOf = (tx: IndexerTransaction): string | undefined => {
    const closeAmount =
        tx['payment-transaction']?.['close-amount'] ??
        tx['asset-transfer-transaction']?.['close-amount']
    return closeAmount === undefined ? undefined : toAmountString(closeAmount)
}

const applicationIdOf = (tx: IndexerTransaction): string | null => {
    const id = tx['application-transaction']?.['application-id']
    return id === undefined ? null : BigInt(id).toString()
}

/** Best-effort `id` extraction from an as-yet-unvalidated row, for logging. */
const extractRowId = (row: unknown): string | undefined => {
    if (typeof row !== 'object' || row === null || !('id' in row)) {
        return undefined
    }
    const { id } = row as { id: unknown }
    return typeof id === 'string' ? id : undefined
}

const transformRow = (
    tx: IndexerTransaction,
    address: string,
    assets: AssetLookup,
): TransactionHistoryItemApiResponse => {
    const assetId = tx['asset-transfer-transaction']?.['asset-id']
    const assetKey =
        assetId === undefined ? undefined : BigInt(assetId).toString()
    const assetFacts = assetKey ? assets.get(assetKey) : undefined

    return {
        id: tx.id,
        // Deliberate cast, not an oversight: `tx-type` is a bare `z.string()`
        // in the indexer schema on purpose (see schema.ts), so an
        // unrecognized transaction type still reaches this point instead of
        // being dropped as an unparseable row. The app's own renderers
        // (useTransactionListItem.ts, mapHistoryItemToDisplayableTransaction.ts)
        // both have a `default:` case specifically for values outside the
        // known enum, so letting an unmodeled type flow through to them is
        // the intended, safer path — do not "fix" this by validating against
        // the enum here.
        tx_type: tx['tx-type'] as TransactionHistoryItemApiResponse['tx_type'],
        sender: tx.sender,
        receiver: receiverOf(tx) ?? null,
        confirmed_round: toNumber(tx['confirmed-round']),
        round_time: toNumber(tx['round-time']),
        fee: toAmountString(tx.fee),
        group_id: tx.group ?? null,
        amount: amountOf(tx) ?? null,
        close_to: closeToOf(tx) ?? null,
        close_amount: closeAmountOf(tx) ?? null,
        asset: assetKey
            ? {
                  asset_id: assetKey,
                  name: assetFacts?.name ?? '',
                  unit_name: assetFacts?.unitName ?? '',
                  decimals: assetFacts?.decimals ?? 0,
              }
            : null,
        application_id: applicationIdOf(tx),
        inner_transaction_count: tx['inner-txns']?.length ?? null,
        balance_impacts: computeBalanceImpacts(tx, address).map(impact => {
            const facts =
                impact.assetId === ALGO_ASSET_KEY
                    ? { unitName: ALGO_UNIT_NAME, decimals: ALGO_DECIMALS }
                    : assets.get(impact.assetId)

            return {
                asset_id: impact.assetId,
                unit_name: facts?.unitName ?? '',
                fraction_decimals: facts?.decimals ?? 0,
                amount: impact.amount.toString(),
            }
        }),
        // `swap_group_detail` and `interpreted_meaning` are Pera-backend
        // interpretations with no indexer equivalent. Both are nullable and
        // optional in the shared schema, so they are simply absent here.
    }
}

/**
 * Maps an indexer account-transactions page onto the Pera backend's response
 * shape, so every downstream transformer, hook and screen is unchanged. The
 * indexer paginates with an opaque `next-token` rather than an absolute URL,
 * and has no notion of a previous page.
 *
 * The pagination envelope is validated strictly (a malformed envelope throws,
 * same as the Pera path's `transactionHistoryResponseSchema.parse`). Each row
 * is then validated independently, mirroring `parseNotificationsListResponse`
 * — a single unparseable transaction is dropped rather than failing the page.
 */
export const transformIndexerTransactions = (
    response: unknown,
    address: string,
    assets: AssetLookup,
): TransactionHistoryApiResponse => {
    const envelope = indexerTransactionsResponseSchema.parse(response)

    const results: TransactionHistoryItemApiResponse[] = []
    for (const row of envelope.transactions) {
        const parsed = indexerTransactionSchema.safeParse(row)
        if (!parsed.success) {
            // A module whose whole purpose is "don't lose rows" must never
            // drop one without a trace — log the row's id (when present) and
            // the zod issue paths so a real-world schema gap like this one
            // (inner transactions with no `id`) shows up in logs instead of
            // just an emptier history list.
            logger.warn('Dropping unparseable indexer transaction row', {
                id: extractRowId(row),
                issues: parsed.error.issues.map(
                    issue =>
                        `${issue.path.join('.') || '(root)'}: ${issue.message}`,
                ),
            })
            continue
        }
        results.push(transformRow(parsed.data, address, assets))
    }

    return {
        current_round: toNumber(envelope['current-round']),
        next: envelope['next-token'] ?? null,
        previous: null,
        results,
    }
}

/** Distinct non-ALGO asset ids referenced by a page, for prefetching facts. */
export const collectAssetIds = (response: unknown): string[] => {
    const ids = new Set<string>()

    // IndexerTransactionNode, not IndexerTransaction: this recurses into
    // inner-txns, whose `id` is optional (see schema.ts) — the walker never
    // reads `id` anyway, but typing it against the row-level (id-required)
    // type would make passing an inner node a type error.
    const walk = (tx: IndexerTransactionNode): void => {
        const assetId = tx['asset-transfer-transaction']?.['asset-id']
        if (assetId !== undefined) ids.add(BigInt(assetId).toString())
        for (const inner of tx['inner-txns'] ?? []) walk(inner)
    }

    const envelope = indexerTransactionsResponseSchema.parse(response)
    for (const row of envelope.transactions) {
        const parsed = indexerTransactionSchema.safeParse(row)
        if (parsed.success) walk(parsed.data)
    }

    return [...ids]
}
