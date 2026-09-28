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
    forEachWriteChunk,
    getDatabase,
    type Database,
} from '@perawallet/wallet-core-database'
import { AssetPricesSchema, AssetPriceMissesSchema } from './schema'

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

    await forEachWriteChunk(rows, async chunk => {
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
    })
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

    await forEachWriteChunk(rows, async chunk => {
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
    })
}

/** Drops miss markers, e.g. once the endpoint starts returning a price. */
export async function clearPriceMisses({
    db = getDatabase(),
    assetIds,
    network,
}: PriceMissesParams): Promise<void> {
    if (assetIds.length === 0) return

    const decimalIds = assetIds.map(id => new Decimal(id))

    await forEachWriteChunk(decimalIds, async chunk => {
        await db
            .delete(AssetPriceMissesSchema)
            .where(
                and(
                    inArray(AssetPriceMissesSchema.assetId, chunk),
                    eq(AssetPriceMissesSchema.network, network),
                ),
            )
            .run()
    })
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

    await forEachWriteChunk(decimalIds, async chunk => {
        await db
            .delete(AssetPricesSchema)
            .where(
                and(
                    inArray(AssetPricesSchema.assetId, chunk),
                    eq(AssetPricesSchema.network, network),
                ),
            )
            .run()
    })
}
