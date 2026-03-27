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
import { AssetsNodeSchema, AssetsPeraSchema, AssetPricesSchema } from './schema'

function fromDb(row: {
    assetId: Decimal
    decimals: number
    creatorAddress: string
    totalSupply: Decimal
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

    for (const item of items) {
        const meta = item.peraMetadata

        await db
            .insert(AssetsPeraSchema)
            .values({
                assetId: new Decimal(item.assetId),
                network,
                verificationTier: meta?.verificationTier ?? 'unverified',
                isDeleted: meta?.isDeleted ?? false,
                assetType: meta?.type ?? null,
                peraMetadataJson: meta ? JSON.stringify(meta) : null,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [AssetsPeraSchema.assetId, AssetsPeraSchema.network],
                set: {
                    verificationTier: meta?.verificationTier ?? 'unverified',
                    isDeleted: meta?.isDeleted ?? false,
                    assetType: meta?.type ?? null,
                    peraMetadataJson: meta ? JSON.stringify(meta) : null,
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
}: GetAssetByIdParams): Promise<PeraAsset | null> {
    const results = await getAssetsByIds({ db, assetIds: [assetId], network })
    return results[0] ?? null
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
