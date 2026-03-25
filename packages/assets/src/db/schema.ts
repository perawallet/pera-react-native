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

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const AssetsSchema = sqliteTable(
    'assets',
    {
        assetId: text('asset_id').notNull(),
        network: text('network').notNull(),
        decimals: integer('decimals').notNull().default(0),
        creatorAddress: text('creator_address').notNull().default(''),
        totalSupply: text('total_supply').notNull().default('0'),
        name: text('name'),
        unitName: text('unit_name'),
        url: text('url'),
        metadata: text('metadata'),
        verificationTier: text('verification_tier')
            .notNull()
            .default('unverified'),
        isDeleted: integer('is_deleted', { mode: 'boolean' })
            .notNull()
            .default(false),
        assetType: text('asset_type'),
        peraMetadataJson: text('pera_metadata_json'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [primaryKey({ columns: [table.assetId, table.network] })],
)
