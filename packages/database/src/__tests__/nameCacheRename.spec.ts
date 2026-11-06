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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { runMigrations, type MigrationConfig } from '../migrator'
import { migrations } from '../migrations'
import { createTestDatabase } from '../test-utils'
import type { Database } from '../database'

const TAG = '0026_name_cache'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

const dump = (db: Database, table: string) =>
    db.values<unknown[]>(
        sql.raw(
            `SELECT address, scope, name, image, source, updated_at FROM ${table} ORDER BY address`,
        ),
    )

describe('name cache table rename', () => {
    let db: Database
    let teardown: () => void
    let before: unknown[][]

    beforeEach(async () => {
        const test = createTestDatabase()
        db = test.db
        teardown = test.teardown
        await runMigrations(db, migrationsBefore(TAG))
        await db.run(sql`
            INSERT INTO nfd_cache (address, scope, name, image, source, updated_at)
            VALUES ('ALGO', 'algorand/mainnet', 'pera.algo', 'https://img', 'nfd', 1),
                   ('0xabc', 'ethereum/mainnet', 'alice.eth', NULL, 'ens', 2),
                   ('NONE', 'algorand/mainnet', NULL, NULL, NULL, 3)
        `)
        before = await dump(db, 'nfd_cache')
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('keeps every cached row, negatives included, under the new table name', async () => {
        expect(await dump(db, 'name_cache')).toEqual(before)
        expect(before).toHaveLength(3)
    })

    it('leaves no table under the old name', async () => {
        const [[count]] = await db.values<[number]>(
            sql`SELECT count(*) FROM sqlite_master WHERE name = 'nfd_cache'`,
        )

        expect(count).toBe(0)
    })

    it('keeps the primary key, so an address cannot be cached twice per scope', async () => {
        await expect(
            db.run(sql`
                INSERT INTO name_cache (address, scope, updated_at)
                VALUES ('ALGO', 'algorand/mainnet', 9)
            `),
        ).rejects.toThrow()
    })

    it('does nothing on a second run', async () => {
        await runMigrations(db, migrations)

        expect(await dump(db, 'name_cache')).toEqual(before)
    })
})
