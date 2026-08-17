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
    inArray,
    notInArray,
    ne,
    or,
    isNull,
    like,
    sql,
} from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    AssetsNodeSchema,
    AssetsPeraSchema,
    AssetPricesSchema,
    PeraAssetType,
    peraAssetFromColumns,
    type PeraAsset,
    type AssetSortMode,
} from '@perawallet/wallet-core-assets'
import { AccountAssetHoldingsSchema, AccountBalancesSchema } from './schema'
import { partition } from '@perawallet/wallet-core-shared'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'

// Max rows per multi-row INSERT/DELETE statement. Each statement is one
// round-trip through the async sqlite-proxy bridge, so batching is far faster
// than per-row writes. Kept well under SQLite's bound-parameter limit.
const HOLDINGS_WRITE_CHUNK_SIZE = 200

export type HoldingRow = {
    assetId: string
    amount: Decimal
    /** Holding-level freeze from algod — frozen assets can't be transferred. */
    isFrozen: boolean
}

type UpsertHoldingInput = {
    assetId: string
    amount: Decimal
    /** Holding-level freeze from algod. Defaults to false when omitted. */
    isFrozen?: boolean
}

type UpsertAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    holdings: UpsertHoldingInput[]
    network: string
}

/**
 * Writes only the delta, returning whether anything changed so the sync service
 * can skip downstream work. Diffing (rather than delete-all + per-row insert)
 * means an unchanged account does zero writes — that loop cost thousands of
 * serialized round-trips through the single SQLite connection every tick.
 */
export async function refreshAccountHoldings({
    db = getDatabase(),
    accountAddress,
    holdings,
    network,
}: UpsertAccountHoldingsParams): Promise<boolean> {
    const now = Date.now()

    const existingRows = await db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            isFrozen: AccountAssetHoldingsSchema.isFrozen,
        })
        .from(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()

    const existing = new Map(
        existingRows.map(r => [
            r.assetId.toString(),
            { amount: r.amount, isFrozen: r.isFrozen },
        ]),
    )
    const incomingIds = new Set(holdings.map(h => h.assetId))

    // Compare canonical string forms — robust whether the incoming amount is a
    // Decimal (production) or another numeric type (some tests), and the DB
    // value always round-trips through Decimal#toString.
    const changed = holdings.filter(h => {
        const prev = existing.get(h.assetId)
        return (
            prev === undefined ||
            prev.amount.toString() !== String(h.amount) ||
            prev.isFrozen !== (h.isFrozen ?? false)
        )
    })
    const removed = [...existing.keys()].filter(id => !incomingIds.has(id))

    if (changed.length === 0 && removed.length === 0) return false

    if (removed.length > 0) {
        const removedDecimals = removed.map(id => new Decimal(id))
        for (const chunk of partition(
            removedDecimals,
            HOLDINGS_WRITE_CHUNK_SIZE,
        )) {
            await db
                .delete(AccountAssetHoldingsSchema)
                .where(
                    and(
                        eq(
                            AccountAssetHoldingsSchema.accountAddress,
                            accountAddress,
                        ),
                        eq(AccountAssetHoldingsSchema.network, network),
                        inArray(AccountAssetHoldingsSchema.assetId, chunk),
                    ),
                )
                .run()
        }
    }

    if (changed.length > 0) {
        const rows = changed.map(h => ({
            accountAddress,
            assetId: new Decimal(h.assetId),
            network,
            amount: h.amount,
            isFrozen: h.isFrozen ?? false,
            updatedAt: now,
        }))
        for (const chunk of partition(rows, HOLDINGS_WRITE_CHUNK_SIZE)) {
            await db
                .insert(AccountAssetHoldingsSchema)
                .values(chunk)
                .onConflictDoUpdate({
                    target: [
                        AccountAssetHoldingsSchema.accountAddress,
                        AccountAssetHoldingsSchema.assetId,
                        AccountAssetHoldingsSchema.network,
                    ],
                    set: {
                        amount: sql`excluded.amount`,
                        isFrozen: sql`excluded.is_frozen`,
                        updatedAt: sql`excluded.updated_at`,
                    },
                })
                .run()
        }
    }

    return true
}

type InsertAssetHoldingParams = {
    db?: Database
    accountAddress: string
    assetId: string
    network: string
    amount?: string
    isFrozen?: boolean
}

export async function insertAssetHolding({
    db = getDatabase(),
    accountAddress,
    assetId,
    network,
    amount,
    isFrozen,
}: InsertAssetHoldingParams): Promise<void> {
    await db
        .insert(AccountAssetHoldingsSchema)
        .values({
            accountAddress,
            assetId: new Decimal(assetId),
            network,
            amount: new Decimal(amount ?? '0'),
            isFrozen: isFrozen ?? false,
            updatedAt: Date.now(),
        })
        .onConflictDoNothing()
        .run()
}

type AddToAssetHoldingParams = {
    db?: Database
    accountAddress: string
    assetId: string
    network: string
    /** Amount to credit, in base units. */
    amount: Decimal
}

/**
 * Surfaces the expected post-transaction balance before the chain reflects it.
 * Can't stick around wrong: the next sync's full diff replaces the row with
 * chain truth. The read-modify-write is safe on the single serialized
 * connection.
 */
export async function addToAssetHolding({
    db = getDatabase(),
    accountAddress,
    assetId,
    network,
    amount,
}: AddToAssetHoldingParams): Promise<void> {
    const conditions = and(
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
        eq(AccountAssetHoldingsSchema.assetId, new Decimal(assetId)),
    )

    const existing = await db
        .select({ amount: AccountAssetHoldingsSchema.amount })
        .from(AccountAssetHoldingsSchema)
        .where(conditions)
        .all()

    const prior = existing[0]?.amount
    if (prior === undefined) {
        await insertAssetHolding({
            db,
            accountAddress,
            assetId,
            network,
            amount: amount.toString(),
        })
        return
    }

    await db
        .update(AccountAssetHoldingsSchema)
        .set({ amount: prior.plus(amount), updatedAt: Date.now() })
        .where(conditions)
        .run()
}

export type AccountHoldingsFilters = {
    /** When true, rows with amount === 0 are excluded. */
    hideZeroBalance?: boolean
    /** When true, NFTs (collectible asset type) are excluded entirely. */
    hideNfts?: boolean
    /** When true, NFTs that are opted-in but have a zero balance are excluded. */
    hideOptedInNfts?: boolean
    /** Asset types to exclude regardless of holding amount. */
    excludeAssetTypes?: string[]
}

type GetAccountHoldingsParams = {
    db?: Database
    accountAddress: string
    network: string
} & AccountHoldingsFilters

export async function getAccountHoldings({
    db = getDatabase(),
    accountAddress,
    network,
    hideZeroBalance,
    hideNfts,
    hideOptedInNfts,
    excludeAssetTypes,
}: GetAccountHoldingsParams): Promise<HoldingRow[]> {
    const needsAssetJoin =
        hideNfts === true ||
        hideOptedInNfts === true ||
        !!excludeAssetTypes?.length

    const baseConditions = [
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
    ]

    if (hideZeroBalance) {
        // Decimal columns are stored as TEXT and normalized via Decimal#toString,
        // so a zero amount is always the literal "0".
        baseConditions.push(
            ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
        )
    }

    if (!needsAssetJoin) {
        const rows = await db
            .select({
                assetId: AccountAssetHoldingsSchema.assetId,
                amount: AccountAssetHoldingsSchema.amount,
                isFrozen: AccountAssetHoldingsSchema.isFrozen,
            })
            .from(AccountAssetHoldingsSchema)
            .where(and(...baseConditions))
            .all()

        return rows.map(r => ({
            assetId: r.assetId.toString(),
            amount: r.amount,
            isFrozen: r.isFrozen,
        }))
    }

    const joinConditions = [...baseConditions]

    if (hideNfts) {
        // Exclude any holding whose asset type is collectible. Unknown
        // (NULL) asset types are kept since we can't yet classify them.
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
            )!,
        )
    } else if (hideOptedInNfts) {
        // Keep all non-NFT holdings, plus NFT holdings with a non-zero balance.
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
            )!,
        )
    }

    if (excludeAssetTypes?.length) {
        joinConditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                notInArray(AssetsPeraSchema.assetType, excludeAssetTypes),
            )!,
        )
    }

    const rows = await db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            isFrozen: AccountAssetHoldingsSchema.isFrozen,
        })
        .from(AccountAssetHoldingsSchema)
        .leftJoin(
            AssetsPeraSchema,
            and(
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    AssetsPeraSchema.assetId,
                ),
                eq(
                    AccountAssetHoldingsSchema.network,
                    AssetsPeraSchema.network,
                ),
            ),
        )
        .where(and(...joinConditions))
        .all()

    return rows.map(r => ({
        assetId: r.assetId.toString(),
        amount: r.amount,
        isFrozen: r.isFrozen,
    }))
}

// Home-screen reads. Both join on the indexed accountAddress and let SQLite do
// the summing, sorting and windowing, so the JS thread only materializes rows
// actually on screen. ALGO participates like any holding, so there's no
// synthetic-row union or per-row special-casing.

const join = (
    table:
        | typeof AssetsNodeSchema
        | typeof AssetsPeraSchema
        | typeof AssetPricesSchema,
) =>
    and(
        eq(AccountAssetHoldingsSchema.assetId, table.assetId),
        eq(AccountAssetHoldingsSchema.network, table.network),
    )

export type AccountPortfolioTotals = {
    /**
     * Display units, price-independent — separate from the USD aggregate so the
     * header can render before the ALGO price syncs.
     */
    algoAmount: Decimal
    /** USD value of all non-ALGO holdings; rows without a price contribute 0. */
    nonAlgoUsdValue: Decimal
    /** Number of holdings rows (includes the ALGO holding). */
    holdingsCount: number
    /** While > 0 the enrichment pass is in flight and the total is settling. */
    missingMetadataCount: number
}

/**
 * Splits the raw ALGO amount from the non-ALGO USD value so the header can
 * reflect the native balance before prices sync.
 *
 * Scales by `CAST('1e' || decimals AS REAL)` rather than `pow`, which SQLite
 * doesn't always ship. Sums are REAL — ample for a displayed total — and
 * wrapped back into Decimal for the app's money convention.
 */
export async function getAccountPortfolioTotals({
    db = getDatabase(),
    accountAddress,
    network,
}: {
    db?: Database
    accountAddress: string
    network: string
}): Promise<AccountPortfolioTotals> {
    const rows = await db
        .select({
            algoAmount: sql<Nullable<number>>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} = '0'
                    THEN CAST(${AccountAssetHoldingsSchema.amount} AS REAL) / 1000000.0
                    ELSE 0 END
            ), 0)`,
            nonAlgoUsd: sql<Nullable<number>>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> '0'
                    THEN CAST(${AccountAssetHoldingsSchema.amount} AS REAL)
                        / CAST('1e' || COALESCE(${AssetsNodeSchema.decimals}, 0) AS REAL)
                        * CAST(${AssetPricesSchema.usdPrice} AS REAL)
                    ELSE 0 END
            ), 0)`,
            count: sql<number>`COUNT(*)`,
            missingMetadata: sql<number>`COALESCE(SUM(
                CASE WHEN ${AccountAssetHoldingsSchema.assetId} <> '0'
                    AND ${AssetsNodeSchema.decimals} IS NULL
                    THEN 1 ELSE 0 END
            ), 0)`,
        })
        .from(AccountAssetHoldingsSchema)
        .leftJoin(AssetsNodeSchema, join(AssetsNodeSchema))
        .leftJoin(AssetPricesSchema, join(AssetPricesSchema))
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
            ),
        )
        .all()

    const row = rows[0]
    return {
        algoAmount: new Decimal(row?.algoAmount ?? 0),
        nonAlgoUsdValue: new Decimal(row?.nonAlgoUsd ?? 0),
        holdingsCount: row?.count ?? 0,
        missingMetadataCount: row?.missingMetadata ?? 0,
    }
}

export type AccountHoldingsPageRow = {
    assetId: string
    /** Amount in base units (microalgos for ALGO). */
    amount: Decimal
    /** Holding-level freeze from algod — frozen assets can't be transferred. */
    isFrozen: boolean
    /** Joined asset metadata, or null until the asset metadata syncs. */
    asset: Nullable<PeraAsset>
    /** Joined USD price, or null until the price syncs. */
    usdPrice: Nullable<Decimal>
    isFavorited: boolean
}

export type GetAccountHoldingsPageParams = {
    db?: Database
    accountAddress: string
    network: string
    /** Sort order applied in SQL. Defaults to balanceDesc. */
    sortMode?: AssetSortMode
    /** Case-insensitive substring match against name / unit name. */
    search?: string
    /** Page size. Omit for an unbounded read (all matching holdings). */
    limit?: number
    /** Row offset for pagination. Ignored when `limit` is omitted. */
    offset?: number
} & AccountHoldingsFilters

/**
 * Sorting (favorites first, then value/name with unsynced NULLs last),
 * filtering, searching and windowing all happen in SQL. Returns raw columns;
 * callers decide how much of each row to materialize.
 */
async function queryHoldingRows({
    db = getDatabase(),
    accountAddress,
    network,
    sortMode = 'balanceDesc',
    search,
    hideZeroBalance,
    hideNfts,
    hideOptedInNfts,
    excludeAssetTypes,
    limit,
    offset,
}: GetAccountHoldingsPageParams) {
    const conditions = [
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
    ]

    if (hideZeroBalance) {
        conditions.push(ne(AccountAssetHoldingsSchema.amount, new Decimal(0)))
    }
    if (hideNfts) {
        conditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
            )!,
        )
    } else if (hideOptedInNfts) {
        conditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                ne(AssetsPeraSchema.assetType, PeraAssetType.collectible),
                ne(AccountAssetHoldingsSchema.amount, new Decimal(0)),
            )!,
        )
    }
    if (excludeAssetTypes?.length) {
        conditions.push(
            or(
                isNull(AssetsPeraSchema.assetType),
                notInArray(AssetsPeraSchema.assetType, excludeAssetTypes),
            )!,
        )
    }
    const term = search?.trim()
    if (term) {
        conditions.push(
            or(
                like(AssetsNodeSchema.name, `%${term}%`),
                like(AssetsNodeSchema.unitName, `%${term}%`),
            )!,
        )
    }

    // Portable 10^decimals scaling (no `pow`): base-unit amount → display units.
    const valueExpr = sql`CAST(${AccountAssetHoldingsSchema.amount} AS REAL) / CAST('1e' || COALESCE(${AssetsNodeSchema.decimals}, 0) AS REAL) * CAST(${AssetPricesSchema.usdPrice} AS REAL)`

    // Favorites first; then value/name with NULLs (unsynced rows) last; then a
    // stable assetId tiebreak.
    const orderBy = [sql`COALESCE(${AssetsPeraSchema.isFavorited}, 0) DESC`]
    switch (sortMode) {
        case 'balanceAsc': {
            orderBy.push(sql`(${valueExpr}) IS NULL`, sql`(${valueExpr}) ASC`)
            break
        }
        case 'alphabeticalAsc': {
            orderBy.push(
                sql`${AssetsNodeSchema.name} IS NULL`,
                sql`${AssetsNodeSchema.name} COLLATE NOCASE ASC`,
            )
            break
        }
        case 'alphabeticalDesc': {
            orderBy.push(
                sql`${AssetsNodeSchema.name} IS NULL`,
                sql`${AssetsNodeSchema.name} COLLATE NOCASE DESC`,
            )
            break
        }
        case 'balanceDesc':
        default: {
            orderBy.push(sql`(${valueExpr}) IS NULL`, sql`(${valueExpr}) DESC`)
        }
    }
    orderBy.push(sql`${AccountAssetHoldingsSchema.assetId} ASC`)

    let query = db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            isFrozen: AccountAssetHoldingsSchema.isFrozen,
            decimals: AssetsNodeSchema.decimals,
            creatorAddress: AssetsNodeSchema.creatorAddress,
            totalSupply: sql<Nullable<string>>`${AssetsNodeSchema.totalSupply}`,
            name: AssetsNodeSchema.name,
            unitName: AssetsNodeSchema.unitName,
            url: AssetsNodeSchema.url,
            metadata: AssetsNodeSchema.metadata,
            peraMetadataJson: AssetsPeraSchema.peraMetadataJson,
            isFavorited: AssetsPeraSchema.isFavorited,
            usdPrice: sql<Nullable<string>>`${AssetPricesSchema.usdPrice}`,
        })
        .from(AccountAssetHoldingsSchema)
        .leftJoin(AssetsNodeSchema, join(AssetsNodeSchema))
        .leftJoin(AssetsPeraSchema, join(AssetsPeraSchema))
        .leftJoin(AssetPricesSchema, join(AssetPricesSchema))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .$dynamic()

    if (limit !== undefined) {
        query = query.limit(limit).offset(offset ?? 0)
    }

    return query.all()
}

/**
 * Fully enriched — every row parses metadata into a `PeraAsset`. Use where the
 * whole result is consumed at once.
 */
export async function getAccountHoldingsPage(
    params: GetAccountHoldingsPageParams,
): Promise<AccountHoldingsPageRow[]> {
    const rows = await queryHoldingRows(params)
    return rows.map(r => ({
        assetId: r.assetId.toString(),
        amount: r.amount,
        isFrozen: r.isFrozen,
        asset:
            r.decimals !== null && r.totalSupply !== null
                ? peraAssetFromColumns({
                      assetId: r.assetId.toString(),
                      decimals: r.decimals,
                      creatorAddress: r.creatorAddress ?? '',
                      totalSupply: new Decimal(r.totalSupply),
                      name: r.name,
                      unitName: r.unitName,
                      url: r.url,
                      metadata: r.metadata,
                      peraMetadataJson: r.peraMetadataJson,
                  })
                : null,
        usdPrice: r.usdPrice != null ? new Decimal(r.usdPrice) : null,
        isFavorited: !!r.isFavorited,
    }))
}

/** Raw holdings row that defers `PeraAsset` materialization to the consumer. */
export type AccountHoldingsLiteRow = {
    assetId: string
    /** Amount in base units (microalgos for ALGO). */
    amount: Decimal
    decimals: Nullable<number>
    creatorAddress: Nullable<string>
    totalSupply: Nullable<string>
    name: Nullable<string>
    unitName: Nullable<string>
    url: Nullable<string>
    metadata: Nullable<string>
    peraMetadataJson: Nullable<string>
    isFavorited: boolean
    /** USD price per whole unit, or null until the price syncs. */
    usdPrice: Nullable<Decimal>
}

/**
 * {@link getAccountHoldingsPage} without building a `PeraAsset` per row. The
 * held-assets list uses this so re-reading thousands of rows doesn't parse
 * metadata for all of them on the JS thread — the burst that blanked the list
 * during sync. Visible rows enrich lazily via {@link assetFromHoldingLiteRow}.
 */
export async function getAccountHoldingsLite(
    params: GetAccountHoldingsPageParams,
): Promise<AccountHoldingsLiteRow[]> {
    const rows = await queryHoldingRows(params)
    return rows.map(r => ({
        assetId: r.assetId.toString(),
        amount: r.amount,
        decimals: r.decimals,
        creatorAddress: r.creatorAddress,
        totalSupply: r.totalSupply,
        name: r.name,
        unitName: r.unitName,
        url: r.url,
        metadata: r.metadata,
        peraMetadataJson: r.peraMetadataJson,
        isFavorited: !!r.isFavorited,
        usdPrice: r.usdPrice != null ? new Decimal(r.usdPrice) : null,
    }))
}

/** The subset of a lite row that materializes into a `PeraAsset`. */
export type AssetColumnsLite = Pick<
    AccountHoldingsLiteRow,
    | 'assetId'
    | 'decimals'
    | 'creatorAddress'
    | 'totalSupply'
    | 'name'
    | 'unitName'
    | 'url'
    | 'metadata'
    | 'peraMetadataJson'
>

/**
 * Call only for rows you actually render — the parse is cached by raw JSON, so
 * scrolling re-renders stay cheap. Null until node metadata has synced.
 */
export const assetFromHoldingLiteRow = (
    row: AssetColumnsLite,
): Nullable<PeraAsset> =>
    row.decimals !== null && row.totalSupply !== null
        ? peraAssetFromColumns({
              assetId: row.assetId,
              decimals: row.decimals,
              creatorAddress: row.creatorAddress ?? '',
              totalSupply: new Decimal(row.totalSupply),
              name: row.name,
              unitName: row.unitName,
              url: row.url,
              metadata: row.metadata,
              peraMetadataJson: row.peraMetadataJson,
          })
        : null

/** SQL-expressible collectible orders. Opt-in-round order is applied by the caller. */
export type CollectibleSqlSortMode =
    | 'titleAsc'
    | 'titleDesc'
    | 'newestFirst'
    | 'oldestFirst'

export type AccountCollectibleLiteRow = AssetColumnsLite & {
    /** Amount held, in base units. Zero means opted in but holding none. */
    amount: Decimal
    /** Pera collectible title; null when metadata hasn't synced. */
    title: Nullable<string>
    collectionName: Nullable<string>
}

export type GetAccountCollectiblesLiteParams = {
    db?: Database
    accountAddress: string
    network: string
    /** Omit to order by asset id descending, for callers that re-sort. */
    sortMode?: CollectibleSqlSortMode
    /** Case-insensitive substring match against title / name / collection. */
    search?: string
    /** When false, collectibles the account holds none of are excluded. */
    includeOptedInOnly?: boolean
}

/**
 * An account's collectibles, filtered/searched/sorted **in SQL**, returned as
 * lite rows that defer `PeraAsset` materialization to the visible ones.
 *
 * Replaces the gallery's old path of reading every holding, shipping all their
 * ids back as a 15k-parameter `IN (…)` list, and parsing every metadata blob
 * on the JS thread.
 */
export async function getAccountCollectiblesLite({
    db = getDatabase(),
    accountAddress,
    network,
    sortMode,
    search,
    includeOptedInOnly = true,
}: GetAccountCollectiblesLiteParams): Promise<AccountCollectibleLiteRow[]> {
    // Built here, not at module scope: a top-level `sql` template dereferences
    // the imported schema at import time, which breaks every consumer that
    // mocks the assets package.
    //
    // Collectible title / collection name live inside `pera_metadata_json`.
    // Reading them with SQLite's `json_extract` keeps sorting and searching in
    // the engine: shipping 15k metadata blobs over the bridge to parse in JS is
    // what made a large NFT gallery take double-digit seconds to first paint
    // (PERA-4861).
    const collectibleTitleExpr = sql<
        Nullable<string>
    >`json_extract(${AssetsPeraSchema.peraMetadataJson}, '$.collectible.title')`
    const collectionNameExpr = sql<
        Nullable<string>
    >`json_extract(${AssetsPeraSchema.peraMetadataJson}, '$.collectible.collection.name')`
    // Asset ids are uint64 stored as TEXT (see `decimalColumn`), so a plain
    // ORDER BY compares them lexicographically — '10' before '9'. Ordering by
    // length first fixes that exactly: for non-negative integers with no
    // leading zeros a shorter string is always the smaller number, and equal
    // lengths compare correctly as text.
    //
    // Deliberately not `CAST(... AS INTEGER)`: SQLite integers are *signed*
    // 64-bit, and a cast past 2^63-1 saturates silently rather than erroring —
    // every id above it would compare equal and sort arbitrarily. Ids are only
    // ~10 digits today, so that's unreachable in practice, but this costs
    // nothing and removes the cliff. Safe on the string form because
    // `Decimal#toString` only switches to exponential notation at 1e21, two
    // digits beyond uint64's maximum.
    const assetIdOrderExprs = [
        sql`length(${AccountAssetHoldingsSchema.assetId})`,
        sql`${AccountAssetHoldingsSchema.assetId}`,
    ]

    const conditions = [
        eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
        eq(AccountAssetHoldingsSchema.network, network),
        eq(AssetsPeraSchema.assetType, PeraAssetType.collectible),
    ]

    if (!includeOptedInOnly) {
        conditions.push(ne(AccountAssetHoldingsSchema.amount, new Decimal(0)))
    }

    const term = search?.trim()
    if (term) {
        const pattern = `%${term}%`
        conditions.push(
            or(
                sql`${collectibleTitleExpr} LIKE ${pattern}`,
                sql`${collectionNameExpr} LIKE ${pattern}`,
                like(AssetsNodeSchema.name, pattern),
            )!,
        )
    }

    // COLLATE NOCASE is ASCII-only folding, so non-ASCII titles order slightly
    // differently than a JS localeCompare would — the same trade the holdings
    // list already makes to keep sorting in SQL.
    const titleExpr = sql`COALESCE(${collectibleTitleExpr}, ${AssetsNodeSchema.name}, '')`
    const orderBy = []
    switch (sortMode) {
        case 'titleAsc': {
            orderBy.push(sql`${titleExpr} COLLATE NOCASE ASC`)
            break
        }
        case 'titleDesc': {
            orderBy.push(sql`${titleExpr} COLLATE NOCASE DESC`)
            break
        }
        case 'oldestFirst': {
            orderBy.push(...assetIdOrderExprs.map(expr => sql`${expr} ASC`))
            break
        }
        case 'newestFirst':
        default: {
            orderBy.push(...assetIdOrderExprs.map(expr => sql`${expr} DESC`))
        }
    }
    orderBy.push(...assetIdOrderExprs.map(expr => sql`${expr} DESC`))

    const rows = await db
        .select({
            assetId: AccountAssetHoldingsSchema.assetId,
            amount: AccountAssetHoldingsSchema.amount,
            decimals: AssetsNodeSchema.decimals,
            creatorAddress: AssetsNodeSchema.creatorAddress,
            totalSupply: sql<Nullable<string>>`${AssetsNodeSchema.totalSupply}`,
            name: AssetsNodeSchema.name,
            unitName: AssetsNodeSchema.unitName,
            url: AssetsNodeSchema.url,
            metadata: AssetsNodeSchema.metadata,
            peraMetadataJson: AssetsPeraSchema.peraMetadataJson,
            title: collectibleTitleExpr,
            collectionName: collectionNameExpr,
        })
        .from(AccountAssetHoldingsSchema)
        // Inner: a collectible is defined by its Pera metadata row.
        .innerJoin(
            AssetsPeraSchema,
            and(
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    AssetsPeraSchema.assetId,
                ),
                eq(
                    AccountAssetHoldingsSchema.network,
                    AssetsPeraSchema.network,
                ),
            ),
        )
        // Inner too: the old path resolved assets through `assets_node`, so a
        // holding whose node metadata hasn't synced was already invisible.
        // Keeping that at the DB level means no null holes in the grid.
        .innerJoin(
            AssetsNodeSchema,
            and(
                eq(
                    AccountAssetHoldingsSchema.assetId,
                    AssetsNodeSchema.assetId,
                ),
                eq(
                    AccountAssetHoldingsSchema.network,
                    AssetsNodeSchema.network,
                ),
            ),
        )
        .where(and(...conditions))
        .orderBy(...orderBy)
        .all()

    return rows.map(row => ({
        assetId: row.assetId.toString(),
        amount: row.amount,
        decimals: row.decimals,
        creatorAddress: row.creatorAddress,
        totalSupply: row.totalSupply,
        name: row.name,
        unitName: row.unitName,
        url: row.url,
        metadata: row.metadata,
        peraMetadataJson: row.peraMetadataJson,
        title: row.title,
        collectionName: row.collectionName,
    }))
}

export type AccountBalanceRow = {
    accountAddress: string
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    minBalance: Decimal
    status: string
    authAddress: Nullable<string>
}

type UpsertAccountBalanceParams = {
    db?: Database
    accountAddress: string
    network: string
    algoBalance: Decimal
    totalAssetsOptedIn: number
    totalCreatedAssets: number
    totalAppsOptedIn: number
    minBalance: Decimal
    status: string
    authAddress: Nullable<string>
}

export async function upsertAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
    algoBalance,
    totalAssetsOptedIn,
    totalCreatedAssets,
    totalAppsOptedIn,
    minBalance,
    status,
    authAddress,
}: UpsertAccountBalanceParams): Promise<void> {
    const now = Date.now()

    await db
        .insert(AccountBalancesSchema)
        .values({
            accountAddress,
            network,
            algoBalance,
            totalAssetsOptedIn,
            totalCreatedAssets,
            totalAppsOptedIn,
            minBalance,
            status,
            authAddress,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [
                AccountBalancesSchema.accountAddress,
                AccountBalancesSchema.network,
            ],
            set: {
                algoBalance,
                totalAssetsOptedIn,
                totalCreatedAssets,
                totalAppsOptedIn,
                minBalance,
                status,
                authAddress,
                updatedAt: now,
            },
        })
        .run()
}

type GetAccountBalanceParams = {
    db?: Database
    accountAddress: string
    network: string
}

export async function getAccountBalance({
    db = getDatabase(),
    accountAddress,
    network,
}: GetAccountBalanceParams): Promise<Optional<AccountBalanceRow>> {
    const rows = await db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalance: AccountBalancesSchema.algoBalance,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
            minBalance: AccountBalancesSchema.minBalance,
            status: AccountBalancesSchema.status,
            authAddress: AccountBalancesSchema.authAddress,
        })
        .from(AccountBalancesSchema)
        .where(
            and(
                eq(AccountBalancesSchema.accountAddress, accountAddress),
                eq(AccountBalancesSchema.network, network),
            ),
        )
        .all()

    return rows[0]
}

type GetAllAccountBalancesParams = {
    db?: Database
    accountAddresses: string[]
    network: string
}

export async function getAllAccountBalances({
    db = getDatabase(),
    accountAddresses,
    network,
}: GetAllAccountBalancesParams): Promise<AccountBalanceRow[]> {
    if (accountAddresses.length === 0) return []

    return db
        .select({
            accountAddress: AccountBalancesSchema.accountAddress,
            algoBalance: AccountBalancesSchema.algoBalance,
            totalAssetsOptedIn: AccountBalancesSchema.totalAssetsOptedIn,
            totalCreatedAssets: AccountBalancesSchema.totalCreatedAssets,
            totalAppsOptedIn: AccountBalancesSchema.totalAppsOptedIn,
            minBalance: AccountBalancesSchema.minBalance,
            status: AccountBalancesSchema.status,
            authAddress: AccountBalancesSchema.authAddress,
        })
        .from(AccountBalancesSchema)
        .where(
            and(
                inArray(AccountBalancesSchema.accountAddress, accountAddresses),
                eq(AccountBalancesSchema.network, network),
            ),
        )
        .all()
}

type DeleteAssetHoldingsParams = {
    db?: Database
    accountAddress: string
    assetIds: string[]
    network: string
}

export async function deleteAssetHoldings({
    db = getDatabase(),
    accountAddress,
    assetIds,
    network,
}: DeleteAssetHoldingsParams): Promise<void> {
    if (assetIds.length === 0) return

    const assetIdDecimals = assetIds.map(id => new Decimal(id))

    await db
        .delete(AccountAssetHoldingsSchema)
        .where(
            and(
                eq(AccountAssetHoldingsSchema.accountAddress, accountAddress),
                eq(AccountAssetHoldingsSchema.network, network),
                inArray(AccountAssetHoldingsSchema.assetId, assetIdDecimals),
            ),
        )
        .run()
}

type GetAllHeldAssetIdsForNetworkParams = {
    db?: Database
    network: string
}

export async function getAllHeldAssetIdsForNetwork({
    db = getDatabase(),
    network,
}: GetAllHeldAssetIdsForNetworkParams): Promise<string[]> {
    const rows = await db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.network, network))
        // Stable order matters: the price syncer slices this list into fixed
        // batches, so an unspecified DISTINCT order re-shuffles batch
        // membership between sync ticks.
        .orderBy(AccountAssetHoldingsSchema.assetId)
        .all()

    return rows.map(r => r.assetId.toString())
}

export type HeldAssetRef = {
    assetId: string
    network: string
}

type GetHeldAssetIdsByAccountParams = {
    db?: Database
    accountAddress: string
}

/** All (assetId, network) pairs the account holds or is opted into, across every network. */
export async function getHeldAssetIdsByAccount({
    db = getDatabase(),
    accountAddress,
}: GetHeldAssetIdsByAccountParams): Promise<HeldAssetRef[]> {
    const rows = await db
        .selectDistinct({
            assetId: AccountAssetHoldingsSchema.assetId,
            network: AccountAssetHoldingsSchema.network,
        })
        .from(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.accountAddress, accountAddress))
        .all()

    return rows.map(r => ({
        assetId: r.assetId.toString(),
        network: r.network,
    }))
}

type DeleteAllAssetHoldingsForAccountParams = {
    db?: Database
    accountAddress: string
}

/** Deletes every holdings row for an account, across all networks. */
export async function deleteAllAssetHoldingsForAccount({
    db = getDatabase(),
    accountAddress,
}: DeleteAllAssetHoldingsForAccountParams): Promise<void> {
    await db
        .delete(AccountAssetHoldingsSchema)
        .where(eq(AccountAssetHoldingsSchema.accountAddress, accountAddress))
        .run()
}

type DeleteAccountBalanceParams = {
    db?: Database
    accountAddress: string
}

/** Deletes every balance row for an account, across all networks. */
export async function deleteAccountBalance({
    db = getDatabase(),
    accountAddress,
}: DeleteAccountBalanceParams): Promise<void> {
    await db
        .delete(AccountBalancesSchema)
        .where(eq(AccountBalancesSchema.accountAddress, accountAddress))
        .run()
}
