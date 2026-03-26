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

import { eq, and, inArray } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { PeraAsset, PeraAssetMetadata } from '../models'
import { AssetsSchema, AssetPricesSchema } from './schema'

type AssetRow = typeof AssetsSchema.$inferInsert

function toDb(asset: PeraAsset, network: string): AssetRow {
    const meta = asset.peraMetadata

    return {
        assetId: asset.assetId,
        network,
        decimals: asset.decimals,
        creatorAddress: asset.creator.address,
        totalSupply: asset.totalSupply.toString(),
        name: asset.name ?? null,
        unitName: asset.unitName ?? null,
        url: asset.url ?? null,
        metadata: asset.metadata ?? null,
        verificationTier: meta?.verificationTier ?? 'unverified',
        isDeleted: meta?.isDeleted ?? false,
        assetType: meta?.type ?? null,
        peraMetadataJson: meta ? JSON.stringify(meta) : null,
        updatedAt: Date.now(),
    }
}

function fromDb(row: {
    assetId: string
    decimals: number
    creatorAddress: string
    totalSupply: string
    name: string | null
    unitName: string | null
    url: string | null
    metadata: string | null
    peraMetadataJson: string | null
}): PeraAsset {
    const peraMetadata: PeraAssetMetadata | undefined = row.peraMetadataJson
        ? (JSON.parse(row.peraMetadataJson) as PeraAssetMetadata)
        : undefined

    return {
        assetId: row.assetId,
        decimals: row.decimals,
        creator: { address: row.creatorAddress },
        totalSupply: Decimal(row.totalSupply),
        name: row.name ?? undefined,
        unitName: row.unitName ?? undefined,
        url: row.url ?? undefined,
        metadata: row.metadata ?? undefined,
        peraMetadata,
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
    if (items.length === 0) return

    for (const item of items) {
        const row = toDb(item, network)

        await db
            .insert(AssetsSchema)
            .values(row)
            .onConflictDoUpdate({
                target: [AssetsSchema.assetId, AssetsSchema.network],
                set: {
                    decimals: row.decimals,
                    creatorAddress: row.creatorAddress,
                    totalSupply: row.totalSupply,
                    name: row.name,
                    unitName: row.unitName,
                    url: row.url,
                    metadata: row.metadata,
                    verificationTier: row.verificationTier,
                    isDeleted: row.isDeleted,
                    assetType: row.assetType,
                    peraMetadataJson: row.peraMetadataJson,
                    updatedAt: row.updatedAt,
                },
            })
            .run()
    }
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

    const rows = await db
        .select({
            assetId: AssetsSchema.assetId,
            decimals: AssetsSchema.decimals,
            creatorAddress: AssetsSchema.creatorAddress,
            totalSupply: AssetsSchema.totalSupply,
            name: AssetsSchema.name,
            unitName: AssetsSchema.unitName,
            url: AssetsSchema.url,
            metadata: AssetsSchema.metadata,
            peraMetadataJson: AssetsSchema.peraMetadataJson,
        })
        .from(AssetsSchema)
        .where(
            and(
                inArray(AssetsSchema.assetId, assetIds),
                eq(AssetsSchema.network, network),
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
}: GetAssetByIdParams): Promise<PeraAsset | null> {
    const results = await getAssetsByIds({ db, assetIds: [assetId], network })
    return results[0] ?? null
}

export type AssetPriceRow = {
    assetId: string
    usdPrice: string
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
                assetId: price.assetId,
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

    return db
        .select({
            assetId: AssetPricesSchema.assetId,
            usdPrice: AssetPricesSchema.usdPrice,
        })
        .from(AssetPricesSchema)
        .where(
            and(
                inArray(AssetPricesSchema.assetId, assetIds),
                eq(AssetPricesSchema.network, network),
            ),
        )
        .all()
}
