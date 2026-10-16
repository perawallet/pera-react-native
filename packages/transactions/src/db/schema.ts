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

import {
    sqliteTable,
    text,
    integer,
    primaryKey,
    index,
} from 'drizzle-orm/sqlite-core'
import type { ChainScopeKey } from '@perawallet/wallet-core-chain-contract'
import { decimalColumn } from '@perawallet/wallet-core-database'
import {
    TransactionHistoryStatuses,
    type TransactionHistoryStatus,
} from '../models/types'

export const TransactionsSchema = sqliteTable(
    'transactions',
    {
        id: text('id').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        txType: text('tx_type').notNull(),
        sender: text('sender').notNull(),
        assetSender: text('asset_sender'),
        receiver: text('receiver'),
        status: text('status')
            .notNull()
            .default(TransactionHistoryStatuses.CONFIRMED)
            .$type<TransactionHistoryStatus>(),
        fee: decimalColumn('fee').notNull(),
        amount: decimalColumn('amount'),
        assetJson: text('asset_json'),
        interpretedMeaningJson: text('interpreted_meaning_json'),
        balanceImpactsJson: text('balance_impacts_json'),
        chainData: text('chain_data').notNull(),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [
        primaryKey({ columns: [table.scope, table.id] }),
        index('transactions_scope_idx').on(table.scope),
    ],
)

export const AccountTransactionsSchema = sqliteTable(
    'account_transactions',
    {
        accountAddress: text('account_address').notNull(),
        transactionId: text('transaction_id').notNull(),
        scope: text('scope').notNull().$type<ChainScopeKey>(),
        assetId: text('asset_id'),
        roundTime: integer('round_time'),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.transactionId, table.scope],
        }),
    ],
)
