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
    index,
    integer,
    primaryKey,
    sqliteTable,
    text,
} from 'drizzle-orm/sqlite-core'
import type { PhishingListEntryKind, PhishingListSourceId } from '../models'

export const PhishingListDomainsSchema = sqliteTable(
    'phishing_list_domains',
    {
        source: text('source').notNull().$type<PhishingListSourceId>(),
        generation: integer('generation').notNull(),
        kind: text('kind').notNull().$type<PhishingListEntryKind>(),
        domain: text('domain').notNull(),
    },
    table => [
        primaryKey({
            columns: [table.source, table.generation, table.kind, table.domain],
        }),
        index('phishing_list_domains_domain_idx').on(table.domain),
    ],
)
