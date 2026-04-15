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

import type { Decimal } from 'decimal.js'

/**
 * Collection definitions for the three asset tables.
 *
 *   - `assets_node`  — node-level asset metadata (creator, supply, unit, decimals, ...)
 *   - `assets_pera`  — Pera-augmented metadata + device-local user fields
 *                      (`isFavorited`, `isPriceAlertEnabled`)
 *   - `asset_prices` — USD prices per asset
 *
 * All three use `${network}:${assetId}` as the composite key, matching
 * the old SQLite composite primary key. `assetId` is serialized as its
 * string representation in the key (which matches its canonical form —
 * Algorand asset ids are non-negative integers and `Decimal.toString()`
 * preserves their exact value), while the field inside the value stays
 * typed as `Decimal` so the Decimal codec round-trips it through MMKV.
 */

// --- assets_node ---

export type AssetsNodeRow = {
    network: string
    assetId: Decimal
    decimals: number
    creatorAddress: string
    totalSupply: Decimal
    name: string | null
    unitName: string | null
    url: string | null
    metadata: string | null
    updatedAt: number
}

export const ASSETS_NODE_COLLECTION_NAME = 'assets_node'
export const ASSETS_NODE_SCHEMA_VERSION = 1

export function assetsNodeKey(row: {
    network: string
    assetId: Decimal | string
}): string {
    return `${row.network}:${row.assetId.toString()}`
}

// --- assets_pera ---

export type AssetsPeraRow = {
    network: string
    assetId: Decimal
    verificationTier: string
    isDeleted: boolean
    assetType: string | null
    /**
     * Serialized `PeraAssetMetadata` (JSON string).
     *
     * Kept as a string — not a structured field — because the
     * `PeraAssetMetadata` type lives in `@perawallet/wallet-core-assets`
     * and the database package must not import from it (would create a
     * cycle). The repository parses/stringifies at the boundary, same
     * as the old Drizzle implementation did.
     */
    peraMetadataJson: string | null
    updatedAt: number
}

export const ASSETS_PERA_COLLECTION_NAME = 'assets_pera'
export const ASSETS_PERA_SCHEMA_VERSION = 1

export function assetsPeraKey(row: {
    network: string
    assetId: Decimal | string
}): string {
    return `${row.network}:${row.assetId.toString()}`
}

// --- asset_prices ---

export type AssetPriceRow = {
    network: string
    assetId: Decimal
    usdPrice: Decimal
    updatedAt: number
}

export const ASSET_PRICES_COLLECTION_NAME = 'asset_prices'
export const ASSET_PRICES_SCHEMA_VERSION = 1

export function assetPricesKey(row: {
    network: string
    assetId: Decimal | string
}): string {
    return `${row.network}:${row.assetId.toString()}`
}
