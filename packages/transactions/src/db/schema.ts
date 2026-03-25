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

export const TransactionsSchema = sqliteTable('transactions', {
    id: text('id').primaryKey(),
    network: text('network').notNull(),
    txType: text('tx_type').notNull(),
    sender: text('sender').notNull(),
    receiver: text('receiver'),
    confirmedRound: integer('confirmed_round').notNull(),
    roundTime: integer('round_time').notNull(),
    fee: text('fee').notNull(),
    groupId: text('group_id'),
    amount: text('amount'),
    closeTo: text('close_to'),
    applicationId: integer('application_id'),
    innerTransactionCount: integer('inner_transaction_count'),
    assetJson: text('asset_json'),
    swapGroupDetailJson: text('swap_group_detail_json'),
    interpretedMeaningJson: text('interpreted_meaning_json'),
    updatedAt: integer('updated_at').notNull(),
})

export const AccountTransactionsSchema = sqliteTable(
    'account_transactions',
    {
        accountAddress: text('account_address').notNull(),
        transactionId: text('transaction_id').notNull(),
        network: text('network').notNull(),
        assetId: text('asset_id'),
        roundTime: integer('round_time').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.accountAddress, table.transactionId, table.network],
        }),
    ],
)
