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
    inArray,
    or,
    sql,
    notExists,
    type SQL,
    type SQLWrapper,
} from 'drizzle-orm'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    isoDateToUnixSeconds,
    logger,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { SECONDS_PER_DAY } from '@perawallet/wallet-core-config'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Decimal } from 'decimal.js'
import {
    TransactionHistoryStatuses,
    type TransactionHistoryItem,
} from '../models/types'
import { TransactionsSchema, AccountTransactionsSchema } from './schema'
import {
    assetFactsResolverFor,
    chainDataCodecFor,
    chainDataCodecOf,
    summarizeHistoryItem,
} from '../history-adapter'
import { fromDb, toDb } from './mappers'

type UpsertTransactionsParams = {
    db?: Database
    items: TransactionHistoryItem[]
    accountAddress: string
    scope: ChainScope
}

/**
 * A JSON column read that yields NULL instead of raising on a malformed value,
 * so one bad cached row cannot fail the whole history query.
 */
const jsonPathAsText = (
    column: SQLWrapper,
    path: string,
): SQL<Nullable<string>> =>
    sql<
        Nullable<string>
    >`CASE WHEN json_valid(${column}) THEN CAST(json_extract(${column}, ${path}) AS TEXT) END`

// json_extract, not jsonPathAsText: a sticky number must stay a number.
const keepStickyChainData = (
    incoming: string,
    stickyPaths: readonly string[],
): SQL =>
    stickyPaths.reduce<SQL>(
        (doc, path) =>
            sql`json_set(${doc}, ${path}, COALESCE(json_extract(${incoming}, ${path}), CASE WHEN json_valid(${TransactionsSchema.chainData}) THEN json_extract(${TransactionsSchema.chainData}, ${path}) END))`,
        sql`${incoming}`,
    )

export async function upsertTransactions({
    db = getDatabase(),
    items,
    accountAddress,
    scope,
}: UpsertTransactionsParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (items.length === 0) return

    const now = Date.now()
    const codec = chainDataCodecFor(scope.chainId)

    for (const item of items) {
        const row = toDb(item, codec)

        await db
            .insert(TransactionsSchema)
            .values({
                ...row,
                scope: scopeKey,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [TransactionsSchema.scope, TransactionsSchema.id],
                set: {
                    txType: row.txType,
                    sender: row.sender,
                    receiver: row.receiver,
                    status: row.status,
                    fee: row.fee,
                    amount: row.amount,
                    // Shared row, per-account derivation (see the codec's
                    // stickyPaths and deriveAssetSender): a perspective that
                    // can't see the clawback must not erase one that could.
                    assetSender: sql`COALESCE(${row.assetSender ?? null}, ${TransactionsSchema.assetSender})`,
                    assetJson: row.assetJson,
                    interpretedMeaningJson: row.interpretedMeaningJson,
                    balanceImpactsJson: row.balanceImpactsJson,
                    chainData: keepStickyChainData(
                        row.chainData,
                        codec.stickyPaths,
                    ),
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
                scope: scopeKey,
                assetId: assetId || null,
                roundTime: item.roundTime,
            })
            // History sorts and pages on the link's time, so it follows a
            // pending row to its confirmed time.
            .onConflictDoUpdate({
                target: [
                    AccountTransactionsSchema.accountAddress,
                    AccountTransactionsSchema.transactionId,
                    AccountTransactionsSchema.scope,
                ],
                set: { roundTime: item.roundTime },
            })
            .run()
    }
}

type GetTransactionHistoryParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
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
 * The backend sets a row's top-level `asset` only for pay/axfer, so swap and
 * app-call rows carry their assets in the balance impacts and chain data.
 * Matching the indexed column alone hides every swap from an asset's history.
 */
const involvesAsset = (
    assetId: string,
    chainDataAssetIdPaths: readonly string[],
): SQL =>
    sql`(${eq(AccountTransactionsSchema.assetId, assetId)}
        OR CASE WHEN json_valid(${TransactionsSchema.balanceImpactsJson})
            THEN EXISTS (
                SELECT 1 FROM json_each(${TransactionsSchema.balanceImpactsJson})
                WHERE CAST(json_extract(json_each.value, '$.assetId') AS TEXT) = ${assetId}
            )
            ELSE 0 END${sql.join(
                chainDataAssetIdPaths.map(
                    path =>
                        sql` OR ${jsonPathAsText(TransactionsSchema.chainData, path)} = ${assetId}`,
                ),
            )})`

export async function getTransactionHistory({
    db = getDatabase(),
    accountAddress,
    scope,
    assetId,
    limit = 25,
    atOrBeforeRoundTime,
    afterTime,
    beforeTime,
}: GetTransactionHistoryParams): Promise<TransactionHistoryItem[]> {
    const scopeKey = toScopeKey(scope)
    const conditions = [
        eq(AccountTransactionsSchema.accountAddress, accountAddress),
        eq(AccountTransactionsSchema.scope, scopeKey),
    ]

    if (assetId !== undefined) {
        conditions.push(
            involvesAsset(
                assetId,
                chainDataCodecOf(scope.chainId)?.assetIdPaths ?? [],
            ),
        )
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
            status: TransactionsSchema.status,
            fee: TransactionsSchema.fee,
            amount: TransactionsSchema.amount,
            assetSender: TransactionsSchema.assetSender,
            assetJson: TransactionsSchema.assetJson,
            interpretedMeaningJson: TransactionsSchema.interpretedMeaningJson,
            balanceImpactsJson: TransactionsSchema.balanceImpactsJson,
            chainData: TransactionsSchema.chainData,
        })
        .from(AccountTransactionsSchema)
        .innerJoin(
            TransactionsSchema,
            and(
                eq(
                    AccountTransactionsSchema.transactionId,
                    TransactionsSchema.id,
                ),
                eq(AccountTransactionsSchema.scope, TransactionsSchema.scope),
            ),
        )
        .where(and(...conditions))
        .orderBy(desc(AccountTransactionsSchema.roundTime))
        .limit(limit)
        .all()

    if (rows.length === 0) return []
    const resolveAssetFacts = assetFactsResolverFor(scope.chainId)
    const codec = chainDataCodecFor(scope.chainId)
    // Every writer goes through JSON.stringify or json_set, so this is a guard,
    // not an expected path: one unparseable row must not fail the whole page.
    return rows.flatMap(row => {
        try {
            return [fromDb(row, resolveAssetFacts, codec)]
        } catch (error) {
            logger.warn('history: skipped a cached row that would not parse', {
                error,
                id: row.id,
            })
            return []
        }
    })
}

type GetRowsByChainDataParams = {
    db?: Database
    scope: ChainScope
    accountAddress: string
    /** JSON paths into chain_data that must hold a value. */
    present?: readonly string[]
    /** JSON paths into chain_data that must be unset or null. */
    missing?: readonly string[]
    /** Bounded per pass: survivors keep matching and retry next sync. */
    limit?: number
}

/**
 * An account's cached rows matching a chain_data predicate, as the work list
 * for a chain's repair. The predicate runs in SQL so `limit` bounds the
 * matching rows; filtering afterwards would keep re-selecting the same healthy
 * oldest rows and a repair would never finish. A row whose chain_data isn't
 * valid JSON never matches, and neither does one with no time.
 *
 * Rows come back in random order, so rows a repair keeps failing on can't hold
 * the first `limit` slots on every pass.
 */
export async function getRowsByChainData({
    db = getDatabase(),
    scope,
    accountAddress,
    present = [],
    missing = [],
    limit = 20,
}: GetRowsByChainDataParams): Promise<
    Array<{ id: string; roundTime: number }>
> {
    const scopeKey = toScopeKey(scope)
    return (
        db
            .select({
                id: TransactionsSchema.id,
                // The NOT NULL filter below makes the narrowed type true.
                roundTime: sql<number>`${AccountTransactionsSchema.roundTime}`,
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
                        AccountTransactionsSchema.scope,
                        TransactionsSchema.scope,
                    ),
                ),
            )
            .where(
                and(
                    eq(TransactionsSchema.scope, scopeKey),
                    eq(
                        AccountTransactionsSchema.accountAddress,
                        accountAddress,
                    ),
                    isNotNull(AccountTransactionsSchema.roundTime),
                    sql`json_valid(${TransactionsSchema.chainData})`,
                    ...present.map(path =>
                        isNotNull(
                            jsonPathAsText(TransactionsSchema.chainData, path),
                        ),
                    ),
                    ...missing.map(path =>
                        isNull(
                            jsonPathAsText(TransactionsSchema.chainData, path),
                        ),
                    ),
                ),
            )
            // ponytail: random rotation, not backoff; a persistently failing row
            // still costs one request each time it's drawn. Add a per-row attempt
            // count if those requests start to matter.
            .orderBy(sql`random()`)
            .limit(limit)
            .all()
    )
}

type ChainDataValueParams = {
    db?: Database
    scope: ChainScope
    id: string
    /** A JSON path into chain_data. */
    path: string
}

/** The value at `path` as text (JSON text for an object); null when unset or the document is malformed. */
export async function getChainDataValue({
    db = getDatabase(),
    scope,
    id,
    path,
}: ChainDataValueParams): Promise<Nullable<string>> {
    const [row] = await db
        .select({
            value: jsonPathAsText(TransactionsSchema.chainData, path),
        })
        .from(TransactionsSchema)
        .where(
            and(
                eq(TransactionsSchema.id, id),
                eq(TransactionsSchema.scope, toScopeKey(scope)),
            ),
        )
        .all()
    return row?.value ?? null
}

export async function setChainDataValue({
    db = getDatabase(),
    scope,
    id,
    path,
    value,
}: ChainDataValueParams & { value: unknown }): Promise<void> {
    await db
        .update(TransactionsSchema)
        .set({
            chainData: sql`json_set(${TransactionsSchema.chainData}, ${path}, json(${JSON.stringify(value)}))`,
        })
        .where(
            and(
                eq(TransactionsSchema.id, id),
                eq(TransactionsSchema.scope, toScopeKey(scope)),
            ),
        )
        .run()
}

type GetLatestTransactionRoundTimeParams = {
    db?: Database
    accountAddress: string
    scope: ChainScope
}

export async function getLatestTransactionRoundTime({
    db = getDatabase(),
    accountAddress,
    scope,
}: GetLatestTransactionRoundTimeParams): Promise<Nullable<number>> {
    const scopeKey = toScopeKey(scope)
    const rows = await db
        .select({
            maxRoundTime: sql<number>`MAX(${AccountTransactionsSchema.roundTime})`,
        })
        .from(AccountTransactionsSchema)
        .where(
            and(
                eq(AccountTransactionsSchema.accountAddress, accountAddress),
                eq(AccountTransactionsSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows[0]?.maxRoundTime ?? null
}

// A failed or replaced send never reached the receiver, so it isn't history
// between the two addresses.
const SETTLED_OR_IN_FLIGHT = [
    TransactionHistoryStatuses.CONFIRMED,
    TransactionHistoryStatuses.PENDING,
]

type GetSentToAddressesParams = {
    db?: Database
    scope: ChainScope
    senders: readonly string[]
}

/** Every receiver any of `senders` has paid in `scope`, as far as the cache reaches. */
export async function getSentToAddresses({
    db = getDatabase(),
    scope,
    senders,
}: GetSentToAddressesParams): Promise<string[]> {
    if (senders.length === 0) return []

    const rows = await db
        .selectDistinct({ receiver: TransactionsSchema.receiver })
        .from(TransactionsSchema)
        .where(
            and(
                eq(TransactionsSchema.scope, toScopeKey(scope)),
                inArray(TransactionsSchema.sender, [...senders]),
                isNotNull(TransactionsSchema.receiver),
                inArray(TransactionsSchema.status, SETTLED_OR_IN_FLIGHT),
            ),
        )
        .all()

    return rows.flatMap(row => (row.receiver ? [row.receiver] : []))
}

export type CounterpartyTransfer = {
    direction: 'incoming' | 'outgoing'
    /** Null when the transfer moves no amount. */
    assetId: Nullable<string>
    /** Base units the own account sent or received, as the chain reads the row from its side; null when it moves no amount. */
    amount: Nullable<Decimal>
}

type GetCounterpartyTransfersParams = {
    db?: Database
    scope: ChainScope
    ownAddresses: readonly string[]
    counterparty: string
}

/** The cached transfers between any of `ownAddresses` and `counterparty`, in either direction. */
export async function getCounterpartyTransfers({
    db = getDatabase(),
    scope,
    ownAddresses,
    counterparty,
}: GetCounterpartyTransfersParams): Promise<CounterpartyTransfer[]> {
    if (ownAddresses.length === 0) return []

    const own = [...ownAddresses]
    const incoming = and(
        eq(TransactionsSchema.sender, counterparty),
        inArray(TransactionsSchema.receiver, own),
    )
    const outgoing = and(
        inArray(TransactionsSchema.sender, own),
        eq(TransactionsSchema.receiver, counterparty),
    )
    const rows = await db
        .select({
            isIncoming: sql<number>`CASE WHEN ${incoming} THEN 1 ELSE 0 END`,
            id: TransactionsSchema.id,
            txType: TransactionsSchema.txType,
            sender: TransactionsSchema.sender,
            receiver: TransactionsSchema.receiver,
            status: TransactionsSchema.status,
            fee: TransactionsSchema.fee,
            amount: TransactionsSchema.amount,
            assetSender: TransactionsSchema.assetSender,
            assetJson: TransactionsSchema.assetJson,
            interpretedMeaningJson: TransactionsSchema.interpretedMeaningJson,
            balanceImpactsJson: TransactionsSchema.balanceImpactsJson,
            chainData: TransactionsSchema.chainData,
        })
        .from(TransactionsSchema)
        .where(
            and(
                eq(TransactionsSchema.scope, toScopeKey(scope)),
                inArray(TransactionsSchema.status, SETTLED_OR_IN_FLIGHT),
                or(incoming, outgoing),
            ),
        )
        .all()

    if (rows.length === 0) return []
    const resolveAssetFacts = assetFactsResolverFor(scope.chainId)
    const codec = chainDataCodecFor(scope.chainId)
    return rows.flatMap(({ isIncoming, ...row }): CounterpartyTransfer[] => {
        const isIn = isIncoming === 1
        const ownSide = isIn ? row.receiver : row.sender
        if (!ownSide) return []
        try {
            // The row's own amount misses what a chain moves besides it, such
            // as the balance an Algorand close-out sweeps into the account.
            const moved = summarizeHistoryItem(
                fromDb(row, resolveAssetFacts, codec),
                ownSide,
                scope.chainId,
            ).amount
            return [
                {
                    direction: isIn ? 'incoming' : 'outgoing',
                    assetId: moved?.assetRef.assetId ?? null,
                    amount: moved?.value ?? null,
                },
            ]
        } catch (error) {
            logger.warn('history: skipped a cached row that would not parse', {
                error,
                id: row.id,
            })
            return []
        }
    })
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
                eq(AccountTransactionsSchema.scope, TransactionsSchema.scope),
            ),
        )

    await db.delete(TransactionsSchema).where(notExists(stillReferenced)).run()
}
