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

import { afterEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { runMigrations, type MigrationConfig } from '../migrator'
import { migrations } from '../migrations'
import { createTestDatabase } from '../test-utils'

const MIGRATION_TAG = '0021_submission_attempts_replacement'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

describe('submission attempt replacement migration', () => {
    let teardown: (() => void) | undefined

    afterEach(() => {
        teardown?.()
        teardown = undefined
    })

    it('keeps rows recorded before it, with no raw transaction and nothing replaced', async () => {
        const test = createTestDatabase()
        teardown = test.teardown
        const { db } = test
        await runMigrations(db, migrationsBefore(MIGRATION_TAG))
        await db.run(sql`
            INSERT INTO submission_attempts (id, scope, tx_ids_json, flow, status, created_at)
            VALUES ('OLD', 'ethereum/mainnet', '["0xaa"]', 'pipeline', 'submitted', 1)
        `)

        await runMigrations(db, migrations)

        const rows = await db.values<[string, string | null, string | null]>(
            sql`
                SELECT id, raw_transaction, replaces_attempt_id FROM submission_attempts
            `,
        )
        expect(rows).toEqual([['OLD', null, null]])
    })
})
