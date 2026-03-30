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
import { Decimal } from 'decimal.js'
import { eq, sql } from 'drizzle-orm'
import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core'
import { createTestDatabase } from '../test-utils'
import { decimalColumn, decimalSum, decimalMax, decimalMin } from '../columns'
import type { Database } from '../database'

const TestSchema = sqliteTable('test_decimals', {
    id: text('id').primaryKey(),
    amount: decimalColumn('amount').notNull(),
})

const GroupedSchema = sqliteTable(
    'test_grouped',
    {
        group: text('group').notNull(),
        amount: decimalColumn('amount').notNull(),
    },
    table => [primaryKey({ columns: [table.group, table.amount] })],
)

const createTable = async (db: Database) => {
    await db.run(
        sql`CREATE TABLE test_decimals (id TEXT PRIMARY KEY, amount TEXT NOT NULL)`,
    )
}

const createGroupedTable = async (db: Database) => {
    await db.run(
        sql`CREATE TABLE test_grouped ("group" TEXT NOT NULL, amount TEXT NOT NULL, PRIMARY KEY ("group", amount))`,
    )
}

describe('decimalColumn', () => {
    let db: Database
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('round-trips a Decimal value through insert and select', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createTable(db)

        await db
            .insert(TestSchema)
            .values({ id: '1', amount: new Decimal('123.456') })
            .run()

        const rows = await db
            .select({ amount: TestSchema.amount })
            .from(TestSchema)
            .where(eq(TestSchema.id, '1'))
            .all()

        expect(rows[0].amount).toBeInstanceOf(Decimal)
        expect(rows[0].amount.toString()).toBe('123.456')
    })

    it('preserves precision beyond Number.MAX_SAFE_INTEGER', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createTable(db)

        const largeValue = new Decimal('99999999999999999')

        await db
            .insert(TestSchema)
            .values({ id: '1', amount: largeValue })
            .run()

        const rows = await db
            .select({ amount: TestSchema.amount })
            .from(TestSchema)
            .all()

        expect(rows[0].amount.toString()).toBe('99999999999999999')
    })

    it('preserves high decimal precision', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createTable(db)

        const preciseValue = new Decimal('1.123456789012345678')

        await db
            .insert(TestSchema)
            .values({ id: '1', amount: preciseValue })
            .run()

        const rows = await db
            .select({ amount: TestSchema.amount })
            .from(TestSchema)
            .all()

        expect(rows[0].amount.toString()).toBe('1.123456789012345678')
    })
})

describe('decimalSum', () => {
    let db: Database
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('sums values and returns a Decimal', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createGroupedTable(db)

        await db
            .insert(GroupedSchema)
            .values([
                { group: 'a', amount: new Decimal('100') },
                { group: 'a', amount: new Decimal('250') },
                { group: 'a', amount: new Decimal('150') },
            ])
            .run()

        const rows = await db
            .select({ total: decimalSum(GroupedSchema.amount) })
            .from(GroupedSchema)
            .all()

        expect(rows[0].total).toBeInstanceOf(Decimal)
        expect(rows[0].total.toString()).toBe('500')
    })

    it('preserves precision when summing large values', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createGroupedTable(db)

        await db
            .insert(GroupedSchema)
            .values([
                { group: 'a', amount: new Decimal('9007199254740993') },
                { group: 'b', amount: new Decimal('9007199254740993') },
            ])
            .run()

        const rows = await db
            .select({ total: decimalSum(GroupedSchema.amount) })
            .from(GroupedSchema)
            .all()

        expect(rows[0].total.toString()).toBe('18014398509481986')
    })

    it('sums fractional values correctly', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createGroupedTable(db)

        await db
            .insert(GroupedSchema)
            .values([
                { group: 'a', amount: new Decimal('1.50') },
                { group: 'a', amount: new Decimal('2.75') },
            ])
            .run()

        const rows = await db
            .select({ total: decimalSum(GroupedSchema.amount) })
            .from(GroupedSchema)
            .all()

        expect(rows[0].total.toString()).toBe('4.25')
    })
})

describe('decimalMax', () => {
    let db: Database
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('returns the maximum value as a Decimal', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createGroupedTable(db)

        await db
            .insert(GroupedSchema)
            .values([
                { group: 'a', amount: new Decimal('100') },
                { group: 'a', amount: new Decimal('500') },
                { group: 'a', amount: new Decimal('250') },
            ])
            .run()

        const rows = await db
            .select({ max: decimalMax(GroupedSchema.amount) })
            .from(GroupedSchema)
            .all()

        expect(rows[0].max).toBeInstanceOf(Decimal)
        expect(rows[0].max.toString()).toBe('500')
    })
})

describe('decimalMin', () => {
    let db: Database
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    it('returns the minimum value as a Decimal', async () => {
        const { db: d, teardown: td } = createTestDatabase()
        db = d
        teardown = td
        await createGroupedTable(db)

        await db
            .insert(GroupedSchema)
            .values([
                { group: 'a', amount: new Decimal('100') },
                { group: 'a', amount: new Decimal('500') },
                { group: 'a', amount: new Decimal('250') },
            ])
            .run()

        const rows = await db
            .select({ min: decimalMin(GroupedSchema.amount) })
            .from(GroupedSchema)
            .all()

        expect(rows[0].min).toBeInstanceOf(Decimal)
        expect(rows[0].min.toString()).toBe('100')
    })
})
