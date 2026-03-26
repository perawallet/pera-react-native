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

import { describe, it, expect, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { runMigrations, type MigrationConfig } from '../migrator'
import { createTestDatabase } from '../test-utils'

const sqliteMaster = sqliteTable('sqlite_master', {
    type: text('type'),
    name: text('name'),
    tblName: text('tbl_name'),
    rootpage: integer('rootpage'),
    sqlDef: text('sql'),
})

const drizzleMigrationsTable = sqliteTable('__drizzle_migrations', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tag: text('tag').notNull().unique(),
    createdAt: integer('created_at').notNull(),
})

describe('runMigrations', () => {
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('creates the migrations tracking table', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const emptyMigrations: MigrationConfig = {
            journal: { entries: [] },
            migrations: {},
        }

        await runMigrations(db, emptyMigrations)

        const tables = await db
            .select({ name: sqliteMaster.name })
            .from(sqliteMaster)
            .where(
                sql`${sqliteMaster.type} = 'table' AND ${sqliteMaster.name} = '__drizzle_migrations'`,
            )
            .all()

        expect(tables).toHaveLength(1)
    })

    it('applies pending migrations', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: {
                entries: [{ idx: 0, when: Date.now(), tag: '0000_test' }],
            },
            migrations: {
                '0000_test':
                    'CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT)',
            },
        }

        await runMigrations(db, migrations)

        const tables = await db
            .select({ name: sqliteMaster.name })
            .from(sqliteMaster)
            .where(
                sql`${sqliteMaster.type} = 'table' AND ${sqliteMaster.name} = 'test_table'`,
            )
            .all()

        expect(tables).toHaveLength(1)
    })

    it('does not re-apply already applied migrations', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: {
                entries: [{ idx: 0, when: Date.now(), tag: '0000_test' }],
            },
            migrations: {
                '0000_test':
                    'CREATE TABLE test_table (id TEXT PRIMARY KEY, name TEXT)',
            },
        }

        await runMigrations(db, migrations)
        await runMigrations(db, migrations)

        const applied = await db
            .select({ tag: drizzleMigrationsTable.tag })
            .from(drizzleMigrationsTable)
            .all()

        expect(applied).toHaveLength(1)
    })

    it('applies multiple migrations in order', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: {
                entries: [
                    { idx: 0, when: Date.now(), tag: '0000_first' },
                    { idx: 1, when: Date.now(), tag: '0001_second' },
                ],
            },
            migrations: {
                '0000_first': 'CREATE TABLE first_table (id TEXT PRIMARY KEY)',
                '0001_second':
                    'CREATE TABLE second_table (id TEXT PRIMARY KEY)',
            },
        }

        await runMigrations(db, migrations)

        const tables = await db
            .select({ name: sqliteMaster.name })
            .from(sqliteMaster)
            .where(
                sql`${sqliteMaster.type} = 'table' AND ${sqliteMaster.name} LIKE '%_table'`,
            )
            .all()

        expect(tables.map(t => t.name).sort()).toEqual([
            'first_table',
            'second_table',
        ])
    })

    it('throws when migration SQL is missing', async () => {
        const { db, teardown: td } = createTestDatabase()
        teardown = td

        const migrations: MigrationConfig = {
            journal: {
                entries: [{ idx: 0, when: Date.now(), tag: '0000_missing' }],
            },
            migrations: {},
        }

        await expect(runMigrations(db, migrations)).rejects.toThrow(
            'Migration SQL not found for tag: 0000_missing',
        )
    })
})
