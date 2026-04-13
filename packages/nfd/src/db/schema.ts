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

export const NfdCacheSchema = sqliteTable(
    'nfd_cache',
    {
        address: text('address').notNull(),
        network: text('network').notNull(),
        /** NULL = looked up, no NFD found (negative cache) */
        name: text('name'),
        image: text('image'),
        source: text('source'),
        updatedAt: integer('updated_at').notNull(),
    },
    table => [primaryKey({ columns: [table.address, table.network] })],
)
