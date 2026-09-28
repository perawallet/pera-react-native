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
    eq,
    and,
    desc,
    isNotNull,
    isNull,
    lt,
    lte,
    gte,
    sql,
    notExists,
    type SQL,
    type SQLWrapper,
} from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    isoDateToUnixSeconds,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import type { TransactionHistoryItem } from '../models/types'
import { TransactionsSchema, AccountTransactionsSchema } from './schema'
import { deserializeSwapGroupDetail, fromDb, toDb } from './mappers'

type UpsertTransactionsParams = {
    db?: Database
    items: TransactionHistoryItem[]
    accountAddress: string
    network: string
}

export async function upsertTransactions({
    db = getDatabase(),
    items,
    accountAddress,
    network,
}: UpsertTransactionsParams): Promise<void> {
    if (items.length === 0) return

    const now = Date.now()

    for (const item of items) {
        const row = toDb(item)

        await db
            .insert(TransactionsSchema)
            .values({
                ...row,
                network,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: TransactionsSchema.id,
                set: {
                    txType: row.txType,
                    sender: row.sender,
                    receiver: row.receiver,
                    confirmedRound: row.confirmedRound,
                    roundTime: row.roundTime,
                    fee: row.fee,
                    groupId: row.groupId,
                    amount: row.amount,
                    closeTo: row.closeTo,
                    // The row is shared across wallet accounts and only some
                    // perspectives can derive the sweep (see
                    // deriveCloseAmount) — never let a sync that can't see
                    // it erase one that could.
                    // Raw sql bypasses decimalColumn's serializer, so bind
                    // the TEXT representation directly.
                    closeAmount: sql`COALESCE(${row.closeAmount?.toString() ?? null}, ${TransactionsSchema.closeAmount})`,
                    applicationId: row.applicationId,
                    innerTransactionCount: row.innerTransactionCount,
                    // Shared row, per-account derivation (see closeAmount
                    // above and deriveAssetSender): a perspective that can't
                    // see the clawback must not erase one that could.
                    assetSender: sql`COALESCE(${row.assetSender ?? null}, ${TransactionsSchema.assetSender})`,
                    assetJson: row.assetJson,
                    swapGroupDetailJson: row.swapGroupDetailJson,
                    interpretedMeaningJson: row.interpretedMeaningJson,
                    balanceImpactsJson: row.balanceImpactsJson,
                    updatedAt: now,
                },
            })
            .run()

        // assetId is a decimal string in current rows; numbers come from rows
        // persisted before the uint64-string migration.
        const assetId = row.assetJson
            ? ((
                  JSON.parse(row.assetJson) as { assetId?: number | string }
              ).assetId?.toString() ?? null)
            : null

        await db
            .insert(AccountTransactionsSchema)
            .values({
                accountAddress,
                transactionId: item.id,
                network,
                assetId: assetId ? new Decimal(assetId) : null,
                roundTime: item.roundTime,
            })
            .onConflictDoNothing()
            .run()
    }
}

type GetTransactionHistoryParams = {
    db?: Database
    accountAddress: string
    network: string
    assetId?: string
    limit?: number
    /**
     * Cursor for keyset pagination: only include txs at or before this round
     * time. Inclusive because an atomic group shares one round time and can
     * straddle a page edge — the caller drops the ids it already holds.
     */
    atOrBeforeRoundTime?: number
    /** Optional: only include txs on/after this date (YYYY-MM-DD, inclusive) */
    afterTime?: string
    /** Optional: only include txs on/before this date (YYYY-MM-DD, inclusive) */
    beforeTime?: string
}

/**
 * A JSON column read that yields NULL instead of raising on a malformed value,
 * so one bad cached row cannot fail the whole history query.
 */
const jsonPathAsText = (column: SQLWrapper, path: string): SQL =>
    sql`CASE WHEN json_valid(${column}) THEN CAST(json_extract(${column}, ${path}) AS TEXT) END`

/**
 * The backend sets a row's top-level `asset` only for pay/axfer, so swap and
 * app-call rows carry their assets in the balance impacts and swap detail.
 * Matching the indexed column alone hides every swap from an asset's history.
 */
const involvesAsset = (assetId: string): SQL =>
    sql`(${eq(AccountTransactionsSchema.assetId, new Decimal(assetId))}
        OR CASE WHEN json_valid(${TransactionsSchema.balanceImpactsJson})
            THEN EXISTS (
                SELECT 1 FROM json_each(${TransactionsSchema.balanceImpactsJson})
                WHERE CAST(json_extract(json_each.value, '$.assetId') AS TEXT) = ${assetId}
            )
            ELSE 0 END
        OR ${jsonPathAsText(TransactionsSchema.swapGroupDetailJson, '$.assetInId')} = ${assetId}
        OR ${jsonPathAsText(TransactionsSchema.swapGroupDetailJson, '$.assetOutId')} = ${assetId})`

export async function getTransactionHistory({
    db = getDatabase(),
    accountAddress,
    network,
    assetId,
    limit = 25,
    atOrBeforeRoundTime,
    afterTime,
    beforeTime,
}: GetTransactionHistoryParams): Promise<TransactionHistoryItem[]> {
    const conditions = [
        eq(AccountTransactionsSchema.accountAddress, accountAddress),
        eq(AccountTransactionsSchema.network, network),
    ]

    if (assetId !== undefined) {
        conditions.push(involvesAsset(assetId))
    }

    if (atOrBeforeRoundTime !== undefined) {
        conditions.push(
            lte(AccountTransactionsSchema.roundTime, atOrBeforeRoundTime),
        )
    }

    const afterRoundTime = isoDateToUnixSeconds(afterTime)
    if (Number.isFinite(afterRoundTime) && afterRoundTime >= 0) {
        conditions.push(
            gte(AccountTransactionsSchema.roundTime, afterRoundTime),
        )
    }

    const beforeStartOfDay = isoDateToUnixSeconds(beforeTime)
    if (Number.isFinite(beforeStartOfDay) && beforeStartOfDay >= 0) {
        // `beforeTime` names a day; include the whole day by cutting off at the
        // start of the next day (day-grain, matching the Pera API semantics).
        conditions.push(
            lt(
                AccountTransactionsSchema.roundTime,
                beforeStartOfDay + SECONDS_PER_DAY,
            ),
        )
    }

    const rows = await db
        .select({
            id: TransactionsSchema.id,
            txType: TransactionsSchema.txType,
            sender: TransactionsSchema.sender,
            receiver: TransactionsSchema.receiver,
            confirmedRound: TransactionsSchema.confirmedRound,
            roundTime: TransactionsSchema.roundTime,
            fee: TransactionsSchema.fee,
            groupId: TransactionsSchema.groupId,
            amount: TransactionsSchema.amount,
            closeTo: TransactionsSchema.closeTo,
            closeAmount: TransactionsSchema.closeAmount,
            applicationId: TransactionsSchema.applicationId,
            innerTransactionCount: TransactionsSchema.innerTransactionCount,
            assetSender: TransactionsSchema.assetSender,
            assetJson: TransactionsSchema.assetJson,
            swapGroupDetailJson: TransactionsSchema.swapGroupDetailJson,
            interpretedMeaningJson: TransactionsSchema.interpretedMeaningJson,
            balanceImpactsJson: TransactionsSchema.balanceImpactsJson,
        })
        .from(AccountTransactionsSchema)
        .innerJoin(
            TransactionsSchema,
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(
                    AccountTransactionsSchema.network,
                    TransactionsSchema.network,
                ),
            ),
        )
        .where(and(...conditions))
        .orderBy(desc(AccountTransactionsSchema.roundTime))
        .limit(limit)
        .all()

    return rows.map(fromDb)
}

type GetCloseRowsMissingCloseAmountParams = {
    db?: Database
    network: string
    /** Bounded per pass — survivors keep matching and retry next sync. */
    limit?: number
}

/**
 * Close-involving rows whose swept amount is unknown: rows cached before the
 * close_amount column existed, or fetched from a perspective that couldn't
 * derive it. These are the chain-backfill work list (see
 * sync/close-amount-backfill.ts).
 */
export async function getCloseRowsMissingCloseAmount({
    db = getDatabase(),
    network,
    limit = 20,
}: GetCloseRowsMissingCloseAmountParams): Promise<Array<{ id: string }>> {
    return db
        .select({ id: TransactionsSchema.id })
        .from(TransactionsSchema)
        .where(
            and(
                eq(TransactionsSchema.network, network),
                isNotNull(TransactionsSchema.closeTo),
                isNull(TransactionsSchema.closeAmount),
            ),
        )
        .limit(limit)
        .all()
}

type GetSwapRowsMissingAssetFactsParams = {
    db?: Database
    network: string
    accountAddress: string
    limit?: number
}

/**
 * Swap rows cached before the per-side asset facts were read off the response,
 * for one account — the caller syncs per account, and an unscoped list would
 * have every account refetch every other account's stale rows.
 *
 * The predicate lives in SQL rather than in a JS filter so `limit` actually
 * bounds the stale rows: filtering afterwards would keep re-selecting the same
 * healthy oldest rows and the backfill would never terminate. `json_extract`
 * raises on malformed input rather than returning null, so it is fed through
 * `json_valid` — one unparseable row would otherwise fail the whole query and
 * silently disable the backfill for good.
 */
export async function getSwapRowsMissingAssetFacts({
    db = getDatabase(),
    network,
    accountAddress,
    limit = 20,
}: GetSwapRowsMissingAssetFactsParams): Promise<
    Array<{ id: string; roundTime: number }>
> {
    return db
        .select({
            id: TransactionsSchema.id,
            roundTime: TransactionsSchema.roundTime,
        })
        .from(TransactionsSchema)
        .innerJoin(
            AccountTransactionsSchema,
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(
                    AccountTransactionsSchema.network,
                    TransactionsSchema.network,
                ),
            ),
        )
        .where(
            and(
                eq(TransactionsSchema.network, network),
                eq(AccountTransactionsSchema.accountAddress, accountAddress),
                isNotNull(TransactionsSchema.swapGroupDetailJson),
                sql`json_extract(CASE WHEN json_valid(${TransactionsSchema.swapGroupDetailJson}) THEN ${TransactionsSchema.swapGroupDetailJson} END, '$.assetInDecimals') IS NULL`,
            ),
        )
        .limit(limit)
        .all()
}

type PersistResolvedSwapAssetFactsParams = {
    db?: Database
    network: string
    ids: string[]
}

/**
 * Writes the read path's resolved swap facts into the rows themselves, so a
 * row the backend could not re-serve stops being re-queried on every sync. The
 * stored value becomes what {@link getTransactionHistory} was already
 * returning for it, so nothing renders differently.
 */
export async function persistResolvedSwapAssetFacts({
    db = getDatabase(),
    network,
    ids,
}: PersistResolvedSwapAssetFactsParams): Promise<void> {
    for (const id of ids) {
        const [row] = await db
            .select({ json: TransactionsSchema.swapGroupDetailJson })
            .from(TransactionsSchema)
            .where(
                and(
                    eq(TransactionsSchema.id, id),
                    eq(TransactionsSchema.network, network),
                ),
            )
            .all()

        const resolved = deserializeSwapGroupDetail(row?.json ?? null)
        if (!resolved) continue

        await db
            .update(TransactionsSchema)
            .set({ swapGroupDetailJson: JSON.stringify(resolved) })
            .where(
                and(
                    eq(TransactionsSchema.id, id),
                    eq(TransactionsSchema.network, network),
                ),
            )
            .run()
    }
}

type UpdateTransactionCloseAmountParams = {
    db?: Database
    id: string
    network: string
    closeAmount: Decimal
}

export async function updateTransactionCloseAmount({
    db = getDatabase(),
    id,
    network,
    closeAmount,
}: UpdateTransactionCloseAmountParams): Promise<void> {
    await db
        .update(TransactionsSchema)
        .set({ closeAmount })
        .where(
            and(
                eq(TransactionsSchema.id, id),
                eq(TransactionsSchema.network, network),
            ),
        )
        .run()
}

type GetLatestTransactionRoundTimeParams = {
    db?: Database
    accountAddress: string
    network: string
}

export async function getLatestTransactionRoundTime({
    db = getDatabase(),
    accountAddress,
    network,
}: GetLatestTransactionRoundTimeParams): Promise<Nullable<number>> {
    const rows = await db
        .select({
            maxRoundTime: sql<number>`MAX(${AccountTransactionsSchema.roundTime})`,
        })
        .from(AccountTransactionsSchema)
        .where(
            and(
                eq(AccountTransactionsSchema.accountAddress, accountAddress),
                eq(AccountTransactionsSchema.network, network),
            ),
        )
        .all()

    return rows[0]?.maxRoundTime ?? null
}

type DeleteTransactionsForAccountParams = {
    db?: Database
    accountAddress: string
}

/**
 * Removes an account's transaction links (all networks), then prunes any
 * `transactions` rows no remaining account still references. A single on-chain
 * transaction can be linked to more than one owned account (e.g. a transfer
 * between them), so the prune is reference-counted per `(id, network)` rather
 * than deleting every transaction the account touched. Idempotent — safe for an
 * address with no data.
 */
export async function deleteTransactionsForAccount({
    db = getDatabase(),
    accountAddress,
}: DeleteTransactionsForAccountParams): Promise<void> {
    await db
        .delete(AccountTransactionsSchema)
        .where(eq(AccountTransactionsSchema.accountAddress, accountAddress))
        .run()

    const stillReferenced = db
        .select({ referenced: sql`1` })
        .from(AccountTransactionsSchema)
        .where(
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(
                    AccountTransactionsSchema.network,
                    TransactionsSchema.network,
                ),
            ),
        )

    await db.delete(TransactionsSchema).where(notExists(stillReferenced)).run()
}
