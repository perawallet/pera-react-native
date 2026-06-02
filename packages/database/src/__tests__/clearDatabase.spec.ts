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

import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { createTestDatabase } from '../test-utils'
import { clearDatabase } from '../database'

describe('clearDatabase', () => {
    it('deletes all rows from user tables', async () => {
        const { db, teardown } = createTestDatabase()
        try {
            await db.run(sql`CREATE TABLE accounts (address TEXT)`)
            await db.run(sql`CREATE TABLE assets (id INTEGER)`)
            await db.run(
                sql`INSERT INTO accounts (address) VALUES ('A'), ('B')`,
            )
            await db.run(sql`INSERT INTO assets (id) VALUES (1), (2), (3)`)

            await clearDatabase(db)

            const accounts = await db.all(sql`SELECT * FROM accounts`)
            const assets = await db.all(sql`SELECT * FROM assets`)
            expect(accounts).toHaveLength(0)
            expect(assets).toHaveLength(0)
        } finally {
            teardown()
        }
    })

    it('keeps the connection usable afterwards (no close/reopen)', async () => {
        const { db, teardown } = createTestDatabase()
        try {
            await db.run(sql`CREATE TABLE accounts (address TEXT)`)
            await db.run(sql`INSERT INTO accounts (address) VALUES ('A')`)

            await clearDatabase(db)

            // Same connection must still accept writes/reads.
            await db.run(sql`INSERT INTO accounts (address) VALUES ('C')`)
            const accounts = await db.all(sql`SELECT * FROM accounts`)
            expect(accounts).toHaveLength(1)
        } finally {
            teardown()
        }
    })

    it('preserves the __drizzle_migrations table so migrations are not re-run', async () => {
        const { db, teardown } = createTestDatabase()
        try {
            await db.run(
                sql`CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL)`,
            )
            await db.run(
                sql`INSERT INTO __drizzle_migrations (tag, created_at) VALUES ('0000_initial', 1)`,
            )
            await db.run(sql`CREATE TABLE accounts (address TEXT)`)
            await db.run(sql`INSERT INTO accounts (address) VALUES ('A')`)

            await clearDatabase(db)

            const migrations = await db.all(
                sql`SELECT * FROM __drizzle_migrations`,
            )
            const accounts = await db.all(sql`SELECT * FROM accounts`)
            expect(migrations).toHaveLength(1)
            expect(accounts).toHaveLength(0)
        } finally {
            teardown()
        }
    })
})
