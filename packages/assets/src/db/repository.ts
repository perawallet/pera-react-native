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

import Decimal from 'decimal.js'
import { getDatabase, type Database } from '@perawallet/wallet-core-database'
import type { PeraAsset, PeraAssetMetadata } from '../models'

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

    const now = Date.now()

    await db.withTransactionAsync(async () => {
        for (const item of items) {
            const meta = item.peraMetadata
            const peraMetadataJson = meta ? JSON.stringify(meta) : null

            await db.runAsync(
                `INSERT INTO assets (asset_id, network, decimals, creator_address, total_supply, name, unit_name, url, metadata, verification_tier, is_deleted, asset_type, pera_metadata_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT (asset_id, network) DO UPDATE SET
                    decimals = excluded.decimals,
                    creator_address = excluded.creator_address,
                    total_supply = excluded.total_supply,
                    name = excluded.name,
                    unit_name = excluded.unit_name,
                    url = excluded.url,
                    metadata = excluded.metadata,
                    verification_tier = excluded.verification_tier,
                    is_deleted = excluded.is_deleted,
                    asset_type = excluded.asset_type,
                    pera_metadata_json = excluded.pera_metadata_json,
                    updated_at = excluded.updated_at`,
                [
                    item.assetId,
                    network,
                    item.decimals,
                    item.creator.address,
                    item.totalSupply.toString(),
                    item.name ?? null,
                    item.unitName ?? null,
                    item.url ?? null,
                    item.metadata ?? null,
                    meta?.verificationTier ?? 'unverified',
                    meta?.isDeleted ? 1 : 0,
                    meta?.type ?? null,
                    peraMetadataJson,
                    now,
                ],
            )
        }
    })
}

type RawAssetRow = {
    asset_id: string
    decimals: number
    creator_address: string
    total_supply: string
    name: string | null
    unit_name: string | null
    url: string | null
    metadata: string | null
    pera_metadata_json: string | null
}

function mapAssetRow(row: RawAssetRow): PeraAsset {
    const peraMetadata: PeraAssetMetadata | undefined = row.pera_metadata_json
        ? (JSON.parse(row.pera_metadata_json) as PeraAssetMetadata)
        : undefined

    return {
        assetId: row.asset_id,
        decimals: row.decimals,
        creator: { address: row.creator_address },
        totalSupply: Decimal(row.total_supply),
        name: row.name ?? undefined,
        unitName: row.unit_name ?? undefined,
        url: row.url ?? undefined,
        metadata: row.metadata ?? undefined,
        peraMetadata,
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

    const placeholders = assetIds.map(() => '?').join(', ')

    const rows = await db.getAllAsync<RawAssetRow>(
        `SELECT asset_id, decimals, creator_address, total_supply, name, unit_name, url, metadata, pera_metadata_json
         FROM assets
         WHERE asset_id IN (${placeholders}) AND network = ?`,
        [...assetIds, network],
    )

    return rows.map(mapAssetRow)
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

    await db.withTransactionAsync(async () => {
        for (const price of prices) {
            await db.runAsync(
                `INSERT INTO asset_prices (asset_id, network, usd_price, updated_at)
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT (asset_id, network) DO UPDATE SET
                    usd_price = excluded.usd_price,
                    updated_at = excluded.updated_at`,
                [price.assetId, network, price.usdPrice, now],
            )
        }
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

    const placeholders = assetIds.map(() => '?').join(', ')

    const rows = await db.getAllAsync<{
        asset_id: string
        usd_price: string
    }>(
        `SELECT asset_id, usd_price FROM asset_prices WHERE asset_id IN (${placeholders}) AND network = ?`,
        [...assetIds, network],
    )

    return rows.map(r => ({ assetId: r.asset_id, usdPrice: r.usd_price }))
}
