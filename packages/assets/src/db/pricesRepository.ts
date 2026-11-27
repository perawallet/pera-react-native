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
import type { Decimal } from 'decimal.js'
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
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
    scope: ChainScope
}

const PRICE_COLUMNS = {
    assetId: sql.identifier(AssetPricesSchema.assetId.name),
    scope: sql.identifier(AssetPricesSchema.scope.name),
    usdPrice: sql.identifier(AssetPricesSchema.usdPrice.name),
    updatedAt: sql.identifier(AssetPricesSchema.updatedAt.name),
}

export async function upsertAssetPrices({
    db = getDatabase(),
    prices,
    scope,
}: UpsertAssetPricesParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (prices.length === 0) return

    const now = Date.now()
    const { assetId, scope: scopeColumn, usdPrice, updatedAt } = PRICE_COLUMNS
    await forEachWriteChunk(prices, async chunk => {
        // The fixed statement binds one payload and keeps prices as decimal text.
        const rows = JSON.stringify(
            chunk.map(price => [price.assetId, price.usdPrice.toString()]),
        )
        // WHERE disambiguates SQLite's UPSERT syntax. Array order preserves the
        // last price for a duplicate ID.
        await db.run(sql`
            INSERT INTO ${AssetPricesSchema} (${assetId}, ${scopeColumn}, ${usdPrice}, ${updatedAt})
            SELECT json_extract(value, '$[0]'), ${scopeKey}, json_extract(value, '$[1]'), ${now}
            FROM json_each(${rows})
            WHERE true
            ORDER BY key
            ON CONFLICT (${assetId}, ${scopeColumn}) DO UPDATE SET
                ${usdPrice} = excluded.${usdPrice},
                ${updatedAt} = excluded.${updatedAt}
        `)
    })
}

type GetAssetPricesByIdsParams = {
    db?: Database
    assetIds: string[]
    scope: ChainScope
}

export async function getAssetPricesByIds({
    db = getDatabase(),
    assetIds,
    scope,
}: GetAssetPricesByIdsParams): Promise<AssetPriceRow[]> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return []

    const rows = await db
        .select({
            assetId: AssetPricesSchema.assetId,
            usdPrice: AssetPricesSchema.usdPrice,
        })
        .from(AssetPricesSchema)
        .where(
            and(
                inArray(AssetPricesSchema.assetId, assetIds),
                eq(AssetPricesSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows
}

type PriceMissesParams = {
    db?: Database
    assetIds: string[]
    scope: ChainScope
}

/** Stamps "the bulk endpoint returned no price" for the given ids, now. */
export async function recordPriceMisses({
    db = getDatabase(),
    assetIds,
    scope,
}: PriceMissesParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return

    const now = Date.now()
    const rows = assetIds.map(assetId => ({
        assetId,
        scope: scopeKey,
        attemptedAt: now,
    }))

    await forEachWriteChunk(rows, async chunk => {
        await db
            .insert(AssetPriceMissesSchema)
            .values(chunk)
            .onConflictDoUpdate({
                target: [
                    AssetPriceMissesSchema.assetId,
                    AssetPriceMissesSchema.scope,
                ],
                set: { attemptedAt: sql`excluded.attempted_at` },
            })
            .run()
    })
}

/** The ids from `assetIds` the price source has answered with no price for, in `scope`. */
export async function getPriceMissAssetIds({
    db = getDatabase(),
    assetIds,
    scope,
}: PriceMissesParams): Promise<string[]> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return []

    const rows = await db
        .select({ assetId: AssetPriceMissesSchema.assetId })
        .from(AssetPriceMissesSchema)
        .where(
            and(
                inArray(AssetPriceMissesSchema.assetId, assetIds),
                eq(AssetPriceMissesSchema.scope, scopeKey),
            ),
        )
        .all()

    return rows.map(row => row.assetId)
}

/** Drops miss markers, e.g. once the endpoint starts returning a price. */
export async function clearPriceMisses({
    db = getDatabase(),
    assetIds,
    scope,
}: PriceMissesParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return

    await forEachWriteChunk(assetIds, async chunk => {
        await db
            .delete(AssetPriceMissesSchema)
            .where(
                and(
                    inArray(AssetPriceMissesSchema.assetId, chunk),
                    eq(AssetPriceMissesSchema.scope, scopeKey),
                ),
            )
            .run()
    })
}

type DeleteAssetPricesParams = {
    db?: Database
    assetIds: string[]
    scope: ChainScope
}

/** Hard-deletes price rows for the given asset IDs on a network. */
export async function deleteAssetPrices({
    db = getDatabase(),
    assetIds,
    scope,
}: DeleteAssetPricesParams): Promise<void> {
    const scopeKey = toScopeKey(scope)
    if (assetIds.length === 0) return

    await forEachWriteChunk(assetIds, async chunk => {
        await db
            .delete(AssetPricesSchema)
            .where(
                and(
                    inArray(AssetPricesSchema.assetId, chunk),
                    eq(AssetPricesSchema.scope, scopeKey),
                ),
            )
            .run()
    })
}
