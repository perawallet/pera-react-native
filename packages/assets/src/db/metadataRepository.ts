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

import { eq, and, inArray, sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type ChainAssetData,
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    forEachWriteChunk,
    getDatabase,
    parseDecimalJson,
    type Database,
} from '@perawallet/wallet-core-database'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import {
    DEFAULT_ASSET_METADATA,
    type PeraAsset,
    type PeraAssetMetadata,
} from '../models'
import { decodeAssetChainData, encodeAssetChainData } from '../chain-adapter'
import { AssetsNodeSchema, AssetsPeraSchema } from './schema'

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
export function peraAssetFromColumns(
    row: {
        assetId: string
        decimals: number
        chainData: Nullable<ChainAssetData>
        totalSupply: Decimal
        name: Nullable<string>
        unitName: Nullable<string>
        url: Nullable<string>
        metadata: Nullable<string>
        peraMetadataJson: Nullable<string>
    },
    chainId: ChainId,
): PeraAsset {
    const peraMetadata: Optional<PeraAssetMetadata> = row.peraMetadataJson
        ? parsePeraMetadata(row.peraMetadataJson)
        : undefined

    return {
        assetId: row.assetId,
        decimals: row.decimals,
        ...decodeAssetChainData(chainId, row.chainData),
        totalSupply: row.totalSupply,
        name: row.name ?? undefined,
        unitName: row.unitName ?? undefined,
        url: row.url ?? undefined,
        metadata: row.metadata ?? undefined,
        peraMetadata,
    }
}

/**
 * The `assets_node` and `assets_pera` columns a joined holdings read needs to
 * build a {@link PeraAsset}; the caller adds `assetId`. A function so the
 * schemas aren't dereferenced at import, which breaks consumers that mock this
 * package.
 */
export const peraAssetJoinColumns = () => ({
    decimals: AssetsNodeSchema.decimals,
    // Both raw TEXT: the caller parses them only for rows it renders.
    totalSupply: sql<Nullable<string>>`${AssetsNodeSchema.totalSupply}`,
    chainData: sql<Nullable<string>>`${AssetsNodeSchema.chainData}`,
    name: AssetsNodeSchema.name,
    unitName: AssetsNodeSchema.unitName,
    url: AssetsNodeSchema.url,
    metadata: AssetsNodeSchema.metadata,
    peraMetadataJson: AssetsPeraSchema.peraMetadataJson,
})

export type PeraAssetJoinRow = {
    assetId: string
    decimals: Nullable<number>
    totalSupply: Nullable<string>
    /** Raw JSON text of the asset's chain data. */
    chainData: Nullable<string>
    name: Nullable<string>
    unitName: Nullable<string>
    url: Nullable<string>
    metadata: Nullable<string>
    peraMetadataJson: Nullable<string>
}

/** Null until the asset's decimals and total supply have synced. */
export function peraAssetFromJoinRow(
    row: PeraAssetJoinRow,
    chainId: ChainId,
): Nullable<PeraAsset> {
    if (row.decimals === null || row.totalSupply === null) return null

    return peraAssetFromColumns(
        {
            assetId: row.assetId,
            decimals: row.decimals,
            chainData: row.chainData
                ? parseDecimalJson<ChainAssetData>(row.chainData)
                : null,
            totalSupply: new Decimal(row.totalSupply),
            name: row.name,
            unitName: row.unitName,
            url: row.url,
            metadata: row.metadata,
            peraMetadataJson: row.peraMetadataJson,
        },
        chainId,
    )
}

type UpsertNodeAssetsParams = {
    db?: Database
    items: PeraAsset[]
    scope: ChainScope
}

export async function upsertNodeAssets({
    db = getDatabase(),
    items,
    scope,
}: UpsertNodeAssetsParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (items.length === 0) return

    const now = Date.now()
    const rows = items.map(item => ({
        assetId: item.assetId,
        scope: scopeKey,
        decimals: item.decimals,
        totalSupply: item.totalSupply,
        name: item.name ?? null,
        unitName: item.unitName ?? null,
        url: item.url ?? null,
        metadata: item.metadata ?? null,
        chainData: encodeAssetChainData(scope.chainId, item),
        updatedAt: now,
    }))

    await forEachWriteChunk(rows, async chunk => {
        await db
            .insert(AssetsNodeSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [AssetsNodeSchema.assetId, AssetsNodeSchema.scope],
                set: {
                    decimals: sql`excluded.decimals`,
                    chainData: sql`excluded.chain_data`,
                    totalSupply: sql`excluded.total_supply`,
                    name: sql`excluded.name`,
                    unitName: sql`excluded.unit_name`,
                    // Asset urls are immutable on-chain, but not every source
                    // carries one — the bulk /v2/assets/ serializer has no url
                    // field at all. An absent url must not erase one already
                    // learned (the ARC19 recheck keys on it).
                    url: sql`coalesce(excluded.url, url)`,
                    metadata: sql`excluded.metadata`,
                    updatedAt: sql`excluded.updated_at`,
                },
            })
            .run()
    })
}

type UpsertPeraAssetsParams = {
    db?: Database
    items: PeraAsset[]
    scope: ChainScope
}

export async function upsertPeraAssets({
    db = getDatabase(),
    items,
    scope,
}: UpsertPeraAssetsParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (items.length === 0) return

    const now = Date.now()

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
                inArray(
                    AssetsPeraSchema.assetId,
                    items.map(i => i.assetId),
                ),
                eq(AssetsPeraSchema.scope, scopeKey),
            ),
        )
        .all()

    const existingMetaMap = new Map<string, PeraAssetMetadata>()
    for (const row of existingRows) {
        if (row.peraMetadataJson) {
            existingMetaMap.set(
                row.assetId,
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
                  // Absent means this source doesn't carry the group: keep
                  // what an earlier read stored, or stay absent so the
                  // unread-group recheck retries a row whose read failed.
                  crossChainAssetGroup:
                      meta.crossChainAssetGroup !== undefined
                          ? meta.crossChainAssetGroup
                          : existing?.crossChainAssetGroup,
              }
            : undefined

        return {
            assetId: item.assetId,
            scope: scopeKey,
            verificationTier: meta?.verificationTier ?? 'unverified',
            isDeleted: meta?.isDeleted ?? false,
            isFavorited: mergedMeta?.isFavorited ?? false,
            assetType: meta?.type ?? null,
            peraMetadataJson: mergedMeta ? JSON.stringify(mergedMeta) : null,
            updatedAt: now,
            firstSeenAt: now,
        }
    })

    await forEachWriteChunk(rows, async chunk => {
        await db
            .insert(AssetsPeraSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [AssetsPeraSchema.assetId, AssetsPeraSchema.scope],
                set: {
                    verificationTier: sql`excluded.verification_tier`,
                    isDeleted: sql`excluded.is_deleted`,
                    isFavorited: sql`excluded.is_favorited`,
                    assetType: sql`excluded.asset_type`,
                    peraMetadataJson: sql`excluded.pera_metadata_json`,
                    updatedAt: sql`excluded.updated_at`,
                    // firstSeenAt absent on purpose — bumping it would keep an
                    // asset "newly seen" forever.
                },
            })
            .run()
    })
}

type UpsertAssetsParams = {
    db?: Database
    items: PeraAsset[]
    scope: ChainScope
}

export async function upsertAssets({
    db = getDatabase(),
    items,
    scope,
}: UpsertAssetsParams): Promise<void> {
    await upsertNodeAssets({ db, items, scope })
    await upsertPeraAssets({ db, items, scope })
}

type GetAssetsByIdsParams = {
    db?: Database
    assetIds: string[]
    scope: ChainScope
}

export async function getAssetsByIds({
    db = getDatabase(),
    assetIds,
    scope,
}: GetAssetsByIdsParams): Promise<PeraAsset[]> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return []

    const rows = await db
        .select({
            assetId: AssetsNodeSchema.assetId,
            decimals: AssetsNodeSchema.decimals,
            chainData: AssetsNodeSchema.chainData,
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
                eq(AssetsNodeSchema.scope, AssetsPeraSchema.scope),
            ),
        )
        .where(
            and(
                inArray(AssetsNodeSchema.assetId, assetIds),
                eq(AssetsNodeSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows.map(row => peraAssetFromColumns(row, scope.chainId))
}

type GetAssetByIdParams = {
    db?: Database
    assetId: string
    scope: ChainScope
}

export async function getAssetById({
    db = getDatabase(),
    assetId,
    scope,
}: GetAssetByIdParams): Promise<Nullable<PeraAsset>> {
    const results = await getAssetsByIds({ db, assetIds: [assetId], scope })
    return results[0] ?? null
}

type GetAssetPeraMetadataParams = {
    db?: Database
    assetId: string
    scope: ChainScope
}

export async function getAssetPeraMetadata({
    db = getDatabase(),
    assetId,
    scope,
}: GetAssetPeraMetadataParams): Promise<Nullable<PeraAssetMetadata>> {
    const scopeKey = toScopeKey(scope)
    const rows = await db
        .select({ peraMetadataJson: AssetsPeraSchema.peraMetadataJson })
        .from(AssetsPeraSchema)
        .where(
            and(
                eq(AssetsPeraSchema.assetId, assetId),
                eq(AssetsPeraSchema.scope, scopeKey),
            ),
        )
        .all()

    if (!rows[0]?.peraMetadataJson) return null
    return JSON.parse(rows[0].peraMetadataJson) as PeraAssetMetadata
}

type UpdateAssetPeraMetadataParams = {
    db?: Database
    assetId: string
    scope: ChainScope
    updates: Partial<PeraAssetMetadata>
}

export async function updateAssetPeraMetadata({
    db = getDatabase(),
    assetId,
    scope,
    updates,
}: UpdateAssetPeraMetadataParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    const now = Date.now()

    const rows = await db
        .select({ peraMetadataJson: AssetsPeraSchema.peraMetadataJson })
        .from(AssetsPeraSchema)
        .where(
            and(
                eq(AssetsPeraSchema.assetId, assetId),
                eq(AssetsPeraSchema.scope, scopeKey),
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
            assetId,
            scope: scopeKey,
            verificationTier: merged.verificationTier,
            isDeleted: merged.isDeleted,
            isFavorited: merged.isFavorited,
            peraMetadataJson: metaJson,
            updatedAt: now,
            // A favorite toggle can be the first thing to cache an asset, so
            // this writer stamps it too — on creation only, as above.
            firstSeenAt: now,
        })
        .onConflictDoUpdate({
            target: [AssetsPeraSchema.assetId, AssetsPeraSchema.scope],
            set: {
                isFavorited: merged.isFavorited,
                peraMetadataJson: metaJson,
                updatedAt: now,
            },
        })
        .run()
}

type DeleteAssetsParams = {
    db?: Database
    assetIds: string[]
    scope: ChainScope
}

/** Hard-deletes node + pera metadata rows for the given asset IDs on a network. */
export async function deleteAssets({
    db = getDatabase(),
    assetIds,
    scope,
}: DeleteAssetsParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return

    await forEachWriteChunk(assetIds, async chunk => {
        await db
            .delete(AssetsNodeSchema)
            .where(
                and(
                    inArray(AssetsNodeSchema.assetId, chunk),
                    eq(AssetsNodeSchema.scope, scopeKey),
                ),
            )
            .run()
        await db
            .delete(AssetsPeraSchema)
            .where(
                and(
                    inArray(AssetsPeraSchema.assetId, chunk),
                    eq(AssetsPeraSchema.scope, scopeKey),
                ),
            )
            .run()
    })
}
