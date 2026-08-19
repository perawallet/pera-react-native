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

import { Decimal } from 'decimal.js'
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { decimalColumn } from '@perawallet/wallet-core-database'

export const AssetsNodeSchema = sqliteTable(
    'assets_node',
    {
        assetId: decimalColumn('asset_id').notNull(),
        network: text('network').notNull(),
        decimals: integer('decimals').notNull().default(0),
        creatorAddress: text('creator_address').notNull().default(''),
        totalSupply: decimalColumn('total_supply')
            .notNull()
            .default(new Decimal(0)),
        name: text('name'),
        unitName: text('unit_name'),
        url: text('url'),
        metadata: text('metadata'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [primaryKey({ columns: [table.assetId, table.network] })],
)

export const AssetsPeraSchema = sqliteTable(
    'assets_pera',
    {
        assetId: decimalColumn('asset_id').notNull(),
        network: text('network').notNull(),
        verificationTier: text('verification_tier')
            .notNull()
            .default('unverified'),
        isDeleted: integer('is_deleted', { mode: 'boolean' })
            .notNull()
            .default(false),
        // Denormalized from peraMetadataJson so the holdings page can order
        // favorites-first in SQL (index-friendly) without parsing JSON per row.
        // Kept in sync wherever peraMetadataJson is written.
        isFavorited: integer('is_favorited', { mode: 'boolean' })
            .notNull()
            .default(false),
        assetType: text('asset_type'),
        peraMetadataJson: text('pera_metadata_json'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [primaryKey({ columns: [table.assetId, table.network] })],
)

export const AssetPricesSchema = sqliteTable(
    'asset_prices',
    {
        assetId: decimalColumn('asset_id').notNull(),
        network: text('network').notNull(),
        usdPrice: decimalColumn('usd_price').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [primaryKey({ columns: [table.assetId, table.network] })],
)

// Ids the bulk price endpoint returned nothing for. Kept out of asset_prices
// (usd_price is NOT NULL and 0 is a legitimate price), so "known priceless"
// can be TTL-gated on its own slower retry cadence.
export const AssetPriceMissesSchema = sqliteTable(
    'asset_price_misses',
    {
        assetId: decimalColumn('asset_id').notNull(),
        network: text('network').notNull(),
        attemptedAt: integer('attempted_at').notNull(),
    },
    table => [primaryKey({ columns: [table.assetId, table.network] })],
)
