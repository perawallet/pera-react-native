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
import type {
    AccountChainState,
    ChainHoldingNative,
    ChainScopeKey,
} from '@perawallet/wallet-core-chain-contract'
import {
    decimalColumn,
    decimalJsonColumn,
} from '@perawallet/wallet-core-database'

export const AccountAssetHoldingsSchema = sqliteTable(
    'account_asset_holdings',
    {
        accountAddress: text('account_address').notNull(),
        assetId: text('asset_id').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        /** Asset amount in base units (smallest indivisible unit of the asset) */
        amount: decimalColumn('amount').notNull().default(new Decimal(0)),
        /** The chain's own data about the holding; null when it has none. */
        native: decimalJsonColumn<ChainHoldingNative>('native'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.assetId, table.scope],
        }),
    ],
)

export const AccountChainStateSchema = sqliteTable(
    'account_chain_state',
    {
        accountAddress: text('account_address').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        /** Base units of the chain's native asset. */
        nativeBalance: decimalColumn('native_balance').notNull(),
        chainData: decimalJsonColumn<AccountChainState>('chain_data').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.scope],
        }),
    ],
)

// Tokens the user added on a chain without opt-in, so they show at a zero
// balance. Algorand's opt-ins live on chain and never land here.
export const AccountAddedTokensSchema = sqliteTable(
    'account_added_tokens',
    {
        accountAddress: text('account_address').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        assetId: text('asset_id').notNull(),
        addedAt: integer('added_at').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.scope, table.assetId],
        }),
    ],
)
