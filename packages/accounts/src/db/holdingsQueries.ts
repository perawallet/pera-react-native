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

import { eq, and, notInArray, ne, or, isNull, like, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    ALGO_ASSET,
    AssetsNodeSchema,
    AssetsPeraSchema,
    AssetPricesSchema,
    PeraAssetType,
    peraAssetFromColumns,
    type PeraAsset,
    type AssetSortMode,
} from '@perawallet/wallet-core-assets'
import { isAlgoAssetId, type Nullable } from '@perawallet/wallet-core-shared'
import { AccountAssetHoldingsSchema } from './schema'
import { holdingJoin } from './holdingJoin'
import type { AccountHoldingsFilters } from './holdingsRepository'

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

    // Portable 10^decimals scaling (no `pow`): base-unit amount → display
    // units. NULL decimals (metadata not yet synced) propagates NULL so a
    // priced-but-unenriched row sorts with the unsynced rows instead of by a
    // base-units × price value 10^decimals too large.
    const valueExpr = sql`CAST(${AccountAssetHoldingsSchema.amount} AS REAL) / CAST('1e' || ${AssetsNodeSchema.decimals} AS REAL) * CAST(${AssetPricesSchema.usdPrice} AS REAL)`

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
        .leftJoin(AssetsNodeSchema, holdingJoin(AssetsNodeSchema))
        .leftJoin(AssetsPeraSchema, holdingJoin(AssetsPeraSchema))
        .leftJoin(AssetPricesSchema, holdingJoin(AssetPricesSchema))
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
    isFrozen: boolean
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
        isFrozen: r.isFrozen,
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
 *
 * ALGO falls back to its local constant rather than null, the same way
 * `useAccountBalancesQuery` treats the enriched rows: its metadata is seeded,
 * never fetched, so a missing row is a local-state failure, and returning null
 * would render the native balance as a skeleton that never resolves.
 */
export const assetFromHoldingLiteRow = (
    row: AssetColumnsLite,
): Nullable<PeraAsset> => {
    if (row.decimals === null || row.totalSupply === null) {
        return isAlgoAssetId(row.assetId) ? ALGO_ASSET : null
    }

    return peraAssetFromColumns({
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
}

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
    /** Case-insensitive substring match against title / name / collection / asset id. */
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
    // what made a large NFT gallery take double-digit seconds to first paint.
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
                like(AccountAssetHoldingsSchema.assetId, pattern),
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
