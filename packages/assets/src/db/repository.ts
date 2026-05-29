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

import { eq, and, inArray, gte } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import {
    DEFAULT_ASSET_METADATA,
    type PeraAsset,
    type PeraAssetMetadata,
} from '../models'
import { AssetsNodeSchema, AssetsPeraSchema, AssetPricesSchema } from './schema'
import { type Nullable, type Optional } from '@perawallet/wallet-core-shared'

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
    const peraMetadata: Optional<PeraAssetMetadata> = row.peraMetadataJson
        ? (JSON.parse(row.peraMetadataJson) as PeraAssetMetadata)
        : undefined

    return {
        assetId: row.assetId.toString(),
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

    for (const item of items) {
        await db
            .insert(AssetsNodeSchema)
            .values({
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
            })
            .onConflictDoUpdate({
                target: [AssetsNodeSchema.assetId, AssetsNodeSchema.network],
                set: {
                    decimals: item.decimals,
                    creatorAddress: item.creator.address,
                    totalSupply: item.totalSupply,
                    name: item.name ?? null,
                    unitName: item.unitName ?? null,
                    url: item.url ?? null,
                    metadata: item.metadata ?? null,
                    updatedAt: now,
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

    // Read existing metadata to preserve device-specific fields (isFavorited, isPriceAlertEnabled)
    // that are only set by toggle mutations and not returned by the sync API
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

    for (const item of items) {
        const meta = item.peraMetadata
        const existing = existingMetaMap.get(item.assetId)

        const mergedMeta = meta
            ? {
                  ...meta,
                  isFavorited: existing?.isFavorited ?? meta.isFavorited,
                  isPriceAlertEnabled:
                      existing?.isPriceAlertEnabled ?? meta.isPriceAlertEnabled,
              }
            : undefined

        const metaJson = mergedMeta ? JSON.stringify(mergedMeta) : null

        await db
            .insert(AssetsPeraSchema)
            .values({
                assetId: new Decimal(item.assetId),
                network,
                verificationTier: meta?.verificationTier ?? 'unverified',
                isDeleted: meta?.isDeleted ?? false,
                assetType: meta?.type ?? null,
                peraMetadataJson: metaJson,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [AssetsPeraSchema.assetId, AssetsPeraSchema.network],
                set: {
                    verificationTier: meta?.verificationTier ?? 'unverified',
                    isDeleted: meta?.isDeleted ?? false,
                    assetType: meta?.type ?? null,
                    peraMetadataJson: metaJson,
                    updatedAt: now,
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
            peraMetadataJson: metaJson,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [AssetsPeraSchema.assetId, AssetsPeraSchema.network],
            set: {
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

    for (const price of prices) {
        await db
            .insert(AssetPricesSchema)
            .values({
                assetId: new Decimal(price.assetId),
                network,
                usdPrice: price.usdPrice,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [AssetPricesSchema.assetId, AssetPricesSchema.network],
                set: {
                    usdPrice: price.usdPrice,
                    updatedAt: now,
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
 * Given a candidate set of asset IDs, returns those that are either not in
 * the DB at all or older than `ttlMs`. Used by the syncer to skip work
 * during steady-state polling.
 *
 * The freshness predicate is pushed into SQL so we only round-trip the
 * matching IDs, not every cached row.
 */
export async function getStaleOrMissingAssetIds({
    db = getDatabase(),
    assetIds,
    network,
    ttlMs,
}: GetStaleOrMissingAssetIdsParams): Promise<string[]> {
    if (assetIds.length === 0) return []

    const decimalIds = assetIds.map(id => new Decimal(id))
    const freshThreshold = Date.now() - ttlMs

    const freshRows = await db
        .select({ assetId: AssetsNodeSchema.assetId })
        .from(AssetsNodeSchema)
        .where(
            and(
                inArray(AssetsNodeSchema.assetId, decimalIds),
                eq(AssetsNodeSchema.network, network),
                gte(AssetsNodeSchema.updatedAt, freshThreshold),
            ),
        )
        .all()

    const freshSet = new Set(freshRows.map(r => r.assetId.toString()))
    return assetIds.filter(id => !freshSet.has(id))
}
