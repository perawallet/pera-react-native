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

export const AccountAssetHoldingsSchema = sqliteTable(
    'account_asset_holdings',
    {
        accountAddress: text('account_address').notNull(),
        assetId: decimalColumn('asset_id').notNull(),
        network: text('network').notNull(),
        /** Asset amount in base units (smallest indivisible unit of the asset) */
        amount: decimalColumn('amount').notNull().default(new Decimal(0)),
        /** Holding-level freeze from algod — frozen assets can't be transferred. */
        isFrozen: integer('is_frozen', { mode: 'boolean' })
            .notNull()
            .default(false),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.assetId, table.network],
        }),
    ],
)

export const AccountBalancesSchema = sqliteTable(
    'account_balances',
    {
        accountAddress: text('account_address').notNull(),
        network: text('network').notNull(),
        /** ALGO balance in display units (ALGOs, not microAlgos) */
        algoBalance: decimalColumn('algo_balance')
            .notNull()
            .default(new Decimal(0)),
        totalAssetsOptedIn: integer('total_assets_opted_in')
            .notNull()
            .default(0),
        totalCreatedAssets: integer('total_created_assets')
            .notNull()
            .default(0),
        totalAppsOptedIn: integer('total_apps_opted_in').notNull().default(0),
        /** Minimum balance in display units (ALGOs, not microAlgos) */
        minBalance: decimalColumn('min_balance')
            .notNull()
            .default(new Decimal(0)),
        status: text('status').notNull().default('Offline'),
        authAddress: text('auth_address'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.network],
        }),
    ],
)
