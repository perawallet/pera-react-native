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

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * One broadcast attempt of an atomic transaction group. Written before the
 * POST (PERA-4588), resolved on definitive outcomes — confirmation, node
 * rejection, or the reconciler — and left open on unknown outcomes so a
 * reconnect can settle them without a rebuild-induced double spend.
 */
export const SubmissionAttemptsSchema = sqliteTable(
    'submission_attempts',
    {
        id: text('id').primaryKey(),
        network: text('network').notNull(),
        /** JSON array of txids — the on-chain dedupe identity of the group. */
        txIdsJson: text('tx_ids_json').notNull(),
        /**
         * JSON intent key (e.g. `{kind:'rekey',address}` / `{kind:'swap',
         * swapId}`). Null for generic sends, which match by txid only.
         */
        intentKeyJson: text('intent_key_json'),
        /** Which flow submitted: pipeline, rekey, swap, cosign, … */
        flow: text('flow').notNull(),
        /** Wallet-held sender address, when known — part of the intent match. */
        sender: text('sender'),
        status: text('status').notNull(),
        /** Decoded txn validity window, in rounds (null when undecodable). */
        firstValid: integer('first_valid'),
        lastValid: integer('last_valid'),
        createdAt: integer('created_at').notNull(),
        resolvedAt: integer('resolved_at'),
    },
    table => [
        index('submission_attempts_open_idx').on(table.network, table.status),
        // The retention sweep runs on every sync tick; without this it is a
        // full scan of a table that grows with every submission.
        index('submission_attempts_retention_idx').on(
            table.status,
            table.createdAt,
        ),
    ],
)
