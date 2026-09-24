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
import { eq, sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Database } from '../database/models'

export type DatabaseContractHandle = {
    db: Database
    teardown?: () => Promise<void> | void
}

const items = sqliteTable('contract_items', {
    id: integer('id').primaryKey(),
    name: text('name').notNull(),
    note: text('note'),
})

/**
 * Shared behavioural contract for every drizzle sqlite-proxy adapter. `createDatabase`
 * must return a database backed by a real SQLite engine, so the suite checks
 * what drizzle hands back per method rather than what a mock was told to say.
 */
export const runDatabaseContract = (
    name: string,
    createDatabase: () => Promise<DatabaseContractHandle>,
): void => {
    describe(`Database contract: ${name}`, () => {
        let handle: DatabaseContractHandle
        let db: Database

        beforeEach(async () => {
            handle = await createDatabase()
            db = handle.db
            await db.run(
                sql`CREATE TABLE contract_items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, note TEXT)`,
            )
            await db.insert(items).values([
                { id: 1, name: 'first', note: 'n1' },
                { id: 2, name: 'second', note: null },
            ])
        })

        afterEach(async () => {
            await handle.teardown?.()
        })

        it('all() resolves every row as a positional value array', async () => {
            const rows = await db.all(
                sql`SELECT id, name FROM contract_items ORDER BY id`,
            )
            expect(rows).toEqual([
                [1, 'first'],
                [2, 'second'],
            ])
        })

        it('values() resolves every row as a positional value array', async () => {
            const rows = await db.values(
                sql`SELECT id, name FROM contract_items ORDER BY id`,
            )
            expect(rows).toEqual([
                [1, 'first'],
                [2, 'second'],
            ])
        })

        it('get() resolves the first row itself, not an array of rows', async () => {
            const row = await db.get(
                sql`SELECT id, name FROM contract_items ORDER BY id`,
            )
            expect(row).toEqual([1, 'first'])
        })

        it('get() resolves undefined when nothing matches', async () => {
            const row = await db.get(
                sql`SELECT id FROM contract_items WHERE id = ${99}`,
            )
            expect(row).toBeUndefined()
        })

        it('maps query-builder selects to objects, including null columns', async () => {
            const rows = await db.select().from(items).orderBy(items.id)
            expect(rows).toEqual([
                { id: 1, name: 'first', note: 'n1' },
                { id: 2, name: 'second', note: null },
            ])
        })

        it('maps a query-builder get() to one object', async () => {
            const row = await db
                .select()
                .from(items)
                .where(eq(items.id, 2))
                .get()
            expect(row).toEqual({ id: 2, name: 'second', note: null })
        })

        it('resolves a query-builder get() to undefined when nothing matches', async () => {
            const row = await db
                .select()
                .from(items)
                .where(eq(items.id, 99))
                .get()
            expect(row).toBeUndefined()
        })

        it('applies updates and deletes issued through run', async () => {
            await db
                .update(items)
                .set({ note: 'changed' })
                .where(eq(items.id, 2))
            await db.delete(items).where(eq(items.id, 1))

            expect(await db.select().from(items)).toEqual([
                { id: 2, name: 'second', note: 'changed' },
            ])
        })

        it('rolls back a transaction that throws', async () => {
            await expect(
                db.transaction(async tx => {
                    await tx.insert(items).values({ id: 3, name: 'third' })
                    throw new Error('abort')
                }),
            ).rejects.toThrow('abort')

            const row = await db
                .select()
                .from(items)
                .where(eq(items.id, 3))
                .get()
            expect(row).toBeUndefined()
        })
    })
}
