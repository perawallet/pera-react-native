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

import { eq, and, inArray, gte, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    DEFAULT_ASSET_METADATA,
    type PeraAsset,
    type PeraAssetMetadata,
} from '../models'
import {
    AssetsNodeSchema,
    AssetsPeraSchema,
    AssetPricesSchema,
    AssetPriceMissesSchema,
} from './schema'
import {
    partition,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'

// Max rows per multi-row upsert. Each statement is one round-trip through the
// async sqlite-proxy bridge, so batching is far faster than per-row writes —
// for a large account this is the difference between ~25 statements and
// thousands. Kept well under SQLite's bound-parameter limit.
const ASSET_WRITE_CHUNK_SIZE = 200

// The held-assets list re-reads every row on each holdings/asset/price
// invalidation, and during a large account's background-sync warm-up that
// happens several times. Parsing the pera-metadata JSON for thousands of rows
// on each pass is a synchronous burst that can starve the JS thread (blank
// rows / unresponsive taps mid-fling). Cache the parsed result by the raw JSON
// string so repeated reads of unchanged metadata skip the parse. A changed
// blob is a different string → a new entry, so there's no staleness risk; the
// returned objects are treated as read-only. Bounded to cap memory.
const PERA_METADATA_CACHE_MAX = 8000
const peraMetadataCache = new Map<string, PeraAssetMetadata>()

function parsePeraMetadata(json: string): PeraAssetMetadata {
    const cached = peraMetadataCache.get(json)
    if (cached) return cached

    const parsed = JSON.parse(json) as PeraAssetMetadata
    if (peraMetadataCache.size >= PERA_METADATA_CACHE_MAX) {
        const oldest = peraMetadataCache.keys().next().value
        if (oldest !== undefined) peraMetadataCache.delete(oldest)
    }
    peraMetadataCache.set(json, parsed)
    return parsed
}

/**
 * Builds a {@link PeraAsset} from raw `assets_node` + `assets_pera` columns.
 * Exported so other packages (e.g. the accounts holdings-page read) can enrich
 * a joined row without going through `getAssetsByIds` and its `IN (…)` list.
 */
export function peraAssetFromColumns(row: {
    assetId: string
    decimals: number
    creatorAddress: string
    totalSupply: Decimal
    name: Nullable<string>
    unitName: Nullable<string>
    url: Nullable<string>
    metadata: Nullable<string>
    peraMetadataJson: Nullable<string>
}): PeraAsset {
    const peraMetadata: Optional<PeraAssetMetadata> = row.peraMetadataJson
        ? parsePeraMetadata(row.peraMetadataJson)
        : undefined

    return {
        assetId: row.assetId,
        decimals: row.decimals,
        creator: { address: row.creatorAddress },
        totalSupply: row.totalSupply,
        name: row.name ?? undefined,
        unitName: row.unitName ?? undefined,
        url: row.url ?? undefined,
        metadata: row.metadata ?? undefined,
        peraMetadata,
    }
}

function fromDb(row: {
    assetId: Decimal
    decimals: number
    creatorAddress: string
    totalSupply: Decimal
    name: Nullable<string>
    unitName: Nullable<string>
    url: Nullable<string>
    metadata: Nullable<string>
    peraMetadataJson: Nullable<string>
}): PeraAsset {
    return peraAssetFromColumns({ ...row, assetId: row.assetId.toString() })
}

type UpsertNodeAssetsParams = {
    db?: Database
    items: PeraAsset[]
    network: string
}

export async function upsertNodeAssets({
    db = getDatabase(),
    items,
    network,
}: UpsertNodeAssetsParams): Promise<void> {
    if (items.length === 0) return

    const now = Date.now()
    const rows = items.map(item => ({
        assetId: new Decimal(item.assetId),
        network,
        decimals: item.decimals,
        creatorAddress: item.creator.address,
        totalSupply: item.totalSupply,
        name: item.name ?? null,
        unitName: item.unitName ?? null,
        url: item.url ?? null,
        metadata: item.metadata ?? null,
        updatedAt: now,
    }))

    for (const chunk of partition(rows, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .insert(AssetsNodeSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [AssetsNodeSchema.assetId, AssetsNodeSchema.network],
                set: {
                    decimals: sql`excluded.decimals`,
                    creatorAddress: sql`excluded.creator_address`,
                    totalSupply: sql`excluded.total_supply`,
                    name: sql`excluded.name`,
                    unitName: sql`excluded.unit_name`,
                    url: sql`excluded.url`,
                    metadata: sql`excluded.metadata`,
                    updatedAt: sql`excluded.updated_at`,
                },
            })
            .run()
    }
}

type UpsertPeraAssetsParams = {
    db?: Database
    items: PeraAsset[]
    network: string
}

export async function upsertPeraAssets({
    db = getDatabase(),
    items,
    network,
}: UpsertPeraAssetsParams): Promise<void> {
    if (items.length === 0) return

    const now = Date.now()
    const decimalIds = items.map(i => new Decimal(i.assetId))

    // Read existing metadata to merge the device-specific fields (isFavorited,
    // isPriceAlertEnabled): a non-device-scoped fetch leaves them null, in which
    // case the existing local value (set by a toggle mutation or an earlier
    // device-scoped sync) is kept; a device-scoped fetch returns real booleans
    // that overwrite.
    const existingRows = await db
        .select({
            assetId: AssetsPeraSchema.assetId,
            peraMetadataJson: AssetsPeraSchema.peraMetadataJson,
        })
        .from(AssetsPeraSchema)
        .where(
            and(
                inArray(AssetsPeraSchema.assetId, decimalIds),
                eq(AssetsPeraSchema.network, network),
            ),
        )
        .all()

    const existingMetaMap = new Map<string, PeraAssetMetadata>()
    for (const row of existingRows) {
        if (row.peraMetadataJson) {
            existingMetaMap.set(
                row.assetId.toString(),
                JSON.parse(row.peraMetadataJson) as PeraAssetMetadata,
            )
        }
    }

    const rows = items.map(item => {
        const meta = item.peraMetadata
        const existing = existingMetaMap.get(item.assetId)

        const mergedMeta = meta
            ? {
                  ...meta,
                  isFavorited:
                      meta.isFavorited ?? existing?.isFavorited ?? false,
                  isPriceAlertEnabled:
                      meta.isPriceAlertEnabled ??
                      existing?.isPriceAlertEnabled ??
                      false,
              }
            : undefined

        return {
            assetId: new Decimal(item.assetId),
            network,
            verificationTier: meta?.verificationTier ?? 'unverified',
            isDeleted: meta?.isDeleted ?? false,
            isFavorited: mergedMeta?.isFavorited ?? false,
            assetType: meta?.type ?? null,
            peraMetadataJson: mergedMeta ? JSON.stringify(mergedMeta) : null,
            updatedAt: now,
        }
    })

    for (const chunk of partition(rows, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .insert(AssetsPeraSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [AssetsPeraSchema.assetId, AssetsPeraSchema.network],
                set: {
                    verificationTier: sql`excluded.verification_tier`,
                    isDeleted: sql`excluded.is_deleted`,
                    isFavorited: sql`excluded.is_favorited`,
                    assetType: sql`excluded.asset_type`,
                    peraMetadataJson: sql`excluded.pera_metadata_json`,
                    updatedAt: sql`excluded.updated_at`,
                },
            })
            .run()
    }
}

type UpsertAssetsParams = {
    db?: Database
    items: PeraAsset[]
    network: string
}

export async function upsertAssets({
    db = getDatabase(),
    items,
    network,
}: UpsertAssetsParams): Promise<void> {
    await upsertNodeAssets({ db, items, network })
    await upsertPeraAssets({ db, items, network })
}

type GetAssetsByIdsParams = {
    db?: Database
    assetIds: string[]
    network: string
}

export async function getAssetsByIds({
    db = getDatabase(),
    assetIds,
    network,
}: GetAssetsByIdsParams): Promise<PeraAsset[]> {
    if (assetIds.length === 0) return []

    const decimalIds = assetIds.map(id => new Decimal(id))

    const rows = await db
        .select({
            assetId: AssetsNodeSchema.assetId,
            decimals: AssetsNodeSchema.decimals,
            creatorAddress: AssetsNodeSchema.creatorAddress,
            totalSupply: AssetsNodeSchema.totalSupply,
            name: AssetsNodeSchema.name,
            unitName: AssetsNodeSchema.unitName,
            url: AssetsNodeSchema.url,
            metadata: AssetsNodeSchema.metadata,
            peraMetadataJson: AssetsPeraSchema.peraMetadataJson,
        })
        .from(AssetsNodeSchema)
        .leftJoin(
            AssetsPeraSchema,
            and(
                eq(AssetsNodeSchema.assetId, AssetsPeraSchema.assetId),
                eq(AssetsNodeSchema.network, AssetsPeraSchema.network),
            ),
        )
        .where(
            and(
                inArray(AssetsNodeSchema.assetId, decimalIds),
                eq(AssetsNodeSchema.network, network),
            ),
        )
        .all()

    return rows.map(fromDb)
}

type GetAssetByIdParams = {
    db?: Database
    assetId: string
    network: string
}

export async function getAssetById({
    db = getDatabase(),
    assetId,
    network,
}: GetAssetByIdParams): Promise<Nullable<PeraAsset>> {
    const results = await getAssetsByIds({ db, assetIds: [assetId], network })
    return results[0] ?? null
}

type GetAssetPeraMetadataParams = {
    db?: Database
    assetId: string
    network: string
}

export async function getAssetPeraMetadata({
    db = getDatabase(),
    assetId,
    network,
}: GetAssetPeraMetadataParams): Promise<Nullable<PeraAssetMetadata>> {
    const rows = await db
        .select({ peraMetadataJson: AssetsPeraSchema.peraMetadataJson })
        .from(AssetsPeraSchema)
        .where(
            and(
                eq(AssetsPeraSchema.assetId, new Decimal(assetId)),
                eq(AssetsPeraSchema.network, network),
            ),
        )
        .all()

    if (!rows[0]?.peraMetadataJson) return null
    return JSON.parse(rows[0].peraMetadataJson) as PeraAssetMetadata
}

type UpdateAssetPeraMetadataParams = {
    db?: Database
    assetId: string
    network: string
    updates: Partial<PeraAssetMetadata>
}

export async function updateAssetPeraMetadata({
    db = getDatabase(),
    assetId,
    network,
    updates,
}: UpdateAssetPeraMetadataParams): Promise<void> {
    const decimalId = new Decimal(assetId)
    const now = Date.now()

    const rows = await db
        .select({ peraMetadataJson: AssetsPeraSchema.peraMetadataJson })
        .from(AssetsPeraSchema)
        .where(
            and(
                eq(AssetsPeraSchema.assetId, decimalId),
                eq(AssetsPeraSchema.network, network),
            ),
        )
        .all()

    const existing: Optional<PeraAssetMetadata> = rows[0]?.peraMetadataJson
        ? (JSON.parse(rows[0].peraMetadataJson) as PeraAssetMetadata)
        : undefined

    const merged: PeraAssetMetadata = {
        ...DEFAULT_ASSET_METADATA,
        ...existing,
        ...updates,
    }
    const metaJson = JSON.stringify(merged)

    await db
        .insert(AssetsPeraSchema)
        .values({
            assetId: decimalId,
            network,
            verificationTier: merged.verificationTier,
            isDeleted: merged.isDeleted,
            isFavorited: merged.isFavorited,
            peraMetadataJson: metaJson,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [AssetsPeraSchema.assetId, AssetsPeraSchema.network],
            set: {
                isFavorited: merged.isFavorited,
                peraMetadataJson: metaJson,
                updatedAt: now,
            },
        })
        .run()
}

export type AssetPriceRow = {
    assetId: string
    usdPrice: Decimal
}

type UpsertAssetPricesParams = {
    db?: Database
    prices: AssetPriceRow[]
    network: string
}

export async function upsertAssetPrices({
    db = getDatabase(),
    prices,
    network,
}: UpsertAssetPricesParams): Promise<void> {
    if (prices.length === 0) return

    const now = Date.now()
    const rows = prices.map(price => ({
        assetId: new Decimal(price.assetId),
        network,
        usdPrice: price.usdPrice,
        updatedAt: now,
    }))

    for (const chunk of partition(rows, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .insert(AssetPricesSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [AssetPricesSchema.assetId, AssetPricesSchema.network],
                set: {
                    usdPrice: sql`excluded.usd_price`,
                    updatedAt: sql`excluded.updated_at`,
                },
            })
            .run()
    }
}

type GetAssetPricesByIdsParams = {
    db?: Database
    assetIds: string[]
    network: string
}

export async function getAssetPricesByIds({
    db = getDatabase(),
    assetIds,
    network,
}: GetAssetPricesByIdsParams): Promise<AssetPriceRow[]> {
    if (assetIds.length === 0) return []

    const decimalIds = assetIds.map(id => new Decimal(id))

    const rows = await db
        .select({
            assetId: AssetPricesSchema.assetId,
            usdPrice: AssetPricesSchema.usdPrice,
        })
        .from(AssetPricesSchema)
        .where(
            and(
                inArray(AssetPricesSchema.assetId, decimalIds),
                eq(AssetPricesSchema.network, network),
            ),
        )
        .all()

    return rows.map(r => ({
        assetId: r.assetId.toString(),
        usdPrice: r.usdPrice,
    }))
}

type GetStaleOrMissingAssetIdsParams = {
    db?: Database
    assetIds: string[]
    network: string
    ttlMs: number
}

/**
 * Shared freshness scan over any table carrying `assetId`/`network`/
 * `updatedAt` columns. The predicate is pushed into SQL so we only
 * round-trip the matching IDs, not every cached row.
 */
async function getStaleOrMissingIdsFromTable({
    db,
    table,
    assetIds,
    network,
    ttlMs,
}: Required<GetStaleOrMissingAssetIdsParams> & {
    table: typeof AssetsNodeSchema | typeof AssetPricesSchema
}): Promise<string[]> {
    if (assetIds.length === 0) return []

    const decimalIds = assetIds.map(id => new Decimal(id))
    const freshThreshold = Date.now() - ttlMs

    const freshRows = await db
        .select({ assetId: table.assetId })
        .from(table)
        .where(
            and(
                inArray(table.assetId, decimalIds),
                eq(table.network, network),
                gte(table.updatedAt, freshThreshold),
            ),
        )
        .all()

    const freshSet = new Set(freshRows.map(r => r.assetId.toString()))
    return assetIds.filter(id => !freshSet.has(id))
}

/**
 * Given a candidate set of asset IDs, returns those that are either not in
 * the DB at all or older than `ttlMs`. Used by the syncer to skip work
 * during steady-state polling.
 */
export async function getStaleOrMissingAssetIds({
    db = getDatabase(),
    ...params
}: GetStaleOrMissingAssetIdsParams): Promise<string[]> {
    return getStaleOrMissingIdsFromTable({
        db,
        table: AssetsNodeSchema,
        ...params,
    })
}

type GetStaleOrMissingPriceAssetIdsParams = GetStaleOrMissingAssetIdsParams & {
    /**
     * When set, ids whose last recorded price miss is younger than this are
     * excluded too — "known priceless" retries on this slower cadence instead
     * of every pass.
     */
    missRetryMs?: number
}

/**
 * Price-row counterpart of `getStaleOrMissingAssetIds`: returns the asset IDs
 * whose price row on `network` is absent or older than `ttlMs`. Lets the
 * price syncer skip refetches when overlapping sync/enrichment paths run
 * within the TTL window.
 */
export async function getStaleOrMissingPriceAssetIds({
    db = getDatabase(),
    missRetryMs,
    ...params
}: GetStaleOrMissingPriceAssetIdsParams): Promise<string[]> {
    const staleOrMissing = await getStaleOrMissingIdsFromTable({
        db,
        table: AssetPricesSchema,
        ...params,
    })
    if (missRetryMs === undefined || staleOrMissing.length === 0) {
        return staleOrMissing
    }

    const decimalIds = staleOrMissing.map(id => new Decimal(id))
    const retryThreshold = Date.now() - missRetryMs

    const deferredRows = await db
        .select({ assetId: AssetPriceMissesSchema.assetId })
        .from(AssetPriceMissesSchema)
        .where(
            and(
                inArray(AssetPriceMissesSchema.assetId, decimalIds),
                eq(AssetPriceMissesSchema.network, params.network),
                gte(AssetPriceMissesSchema.attemptedAt, retryThreshold),
            ),
        )
        .all()

    const deferredSet = new Set(deferredRows.map(r => r.assetId.toString()))
    return staleOrMissing.filter(id => !deferredSet.has(id))
}

type PriceMissesParams = {
    db?: Database
    assetIds: string[]
    network: string
}

/** Stamps "the bulk endpoint returned no price" for the given ids, now. */
export async function recordPriceMisses({
    db = getDatabase(),
    assetIds,
    network,
}: PriceMissesParams): Promise<void> {
    if (assetIds.length === 0) return

    const now = Date.now()
    const rows = assetIds.map(assetId => ({
        assetId: new Decimal(assetId),
        network,
        attemptedAt: now,
    }))

    for (const chunk of partition(rows, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .insert(AssetPriceMissesSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [
                    AssetPriceMissesSchema.assetId,
                    AssetPriceMissesSchema.network,
                ],
                set: { attemptedAt: sql`excluded.attempted_at` },
            })
            .run()
    }
}

/** Drops miss markers, e.g. once the endpoint starts returning a price. */
export async function clearPriceMisses({
    db = getDatabase(),
    assetIds,
    network,
}: PriceMissesParams): Promise<void> {
    if (assetIds.length === 0) return

    const decimalIds = assetIds.map(id => new Decimal(id))

    for (const chunk of partition(decimalIds, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .delete(AssetPriceMissesSchema)
            .where(
                and(
                    inArray(AssetPriceMissesSchema.assetId, chunk),
                    eq(AssetPriceMissesSchema.network, network),
                ),
            )
            .run()
    }
}

type DeleteAssetsParams = {
    db?: Database
    assetIds: string[]
    network: string
}

/** Hard-deletes node + pera metadata rows for the given asset IDs on a network. */
export async function deleteAssets({
    db = getDatabase(),
    assetIds,
    network,
}: DeleteAssetsParams): Promise<void> {
    if (assetIds.length === 0) return

    const decimalIds = assetIds.map(id => new Decimal(id))

    for (const chunk of partition(decimalIds, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .delete(AssetsNodeSchema)
            .where(
                and(
                    inArray(AssetsNodeSchema.assetId, chunk),
                    eq(AssetsNodeSchema.network, network),
                ),
            )
            .run()
        await db
            .delete(AssetsPeraSchema)
            .where(
                and(
                    inArray(AssetsPeraSchema.assetId, chunk),
                    eq(AssetsPeraSchema.network, network),
                ),
            )
            .run()
    }
}

type DeleteAssetPricesParams = {
    db?: Database
    assetIds: string[]
    network: string
}

/** Hard-deletes price rows for the given asset IDs on a network. */
export async function deleteAssetPrices({
    db = getDatabase(),
    assetIds,
    network,
}: DeleteAssetPricesParams): Promise<void> {
    if (assetIds.length === 0) return

    const decimalIds = assetIds.map(id => new Decimal(id))

    for (const chunk of partition(decimalIds, ASSET_WRITE_CHUNK_SIZE)) {
        await db
            .delete(AssetPricesSchema)
            .where(
                and(
                    inArray(AssetPricesSchema.assetId, chunk),
                    eq(AssetPricesSchema.network, network),
                ),
            )
            .run()
    }
}
