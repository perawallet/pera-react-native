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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import type { DatabaseService } from '@perawallet/wallet-extension-platform'
import { runMigrations, type MigrationConfig } from '../migrator'
import { migrations } from '../migrations'
import { createTestDatabase } from '../test-utils'
import { initializeDatabase, resetDatabase, type Database } from '../database'

const REBUILD_TAG = '0009_text_asset_ids'

const REBUILT_TABLES = [
    'account_asset_holdings',
    'assets_node',
    'assets_pera',
    'asset_prices',
    'asset_price_misses',
] as const

const NETWORKS = ['algorand/mainnet', 'algorand/testnet'] as const

const HOLDINGS_PER_NETWORK = 5_000
const INSERT_CHUNK = 500

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

const seedCachedRows = async (db: Database): Promise<void> => {
    for (const network of NETWORKS) {
        for (
            let start = 0;
            start < HOLDINGS_PER_NETWORK;
            start += INSERT_CHUNK
        ) {
            const values = Array.from(
                { length: INSERT_CHUNK },
                (_, i) =>
                    `('ADDR', '${start + i}', '${network}', '${start + i}', 0, 1)`,
            ).join(', ')
            await db.run(
                sql.raw(
                    `INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, is_frozen, updated_at) VALUES ${values}`,
                ),
            )
        }
        await db.run(sql`
            INSERT INTO account_balances (account_address, network, algo_balance, updated_at)
            VALUES ('ADDR', ${network}, '12.5', 1)
        `)
        await db.run(sql`
            INSERT INTO account_transactions (account_address, transaction_id, network, asset_id, round_time)
            VALUES ('ADDR', ${`TX-${network}`}, ${network}, '31566704', 1)
        `)
        await db.run(sql`
            INSERT INTO assets_node (asset_id, network, updated_at) VALUES ('7', ${network}, 1)
        `)
        await db.run(sql`
            INSERT INTO assets_pera (asset_id, network, updated_at, first_seen_at)
            VALUES ('7', ${network}, 1, 1)
        `)
        await db.run(sql`
            INSERT INTO asset_prices (asset_id, network, usd_price, updated_at)
            VALUES ('7', ${network}, '0.25', 1)
        `)
        await db.run(sql`
            INSERT INTO asset_price_misses (asset_id, network, attempted_at)
            VALUES ('8', ${network}, 1)
        `)
        await db.run(sql`
            INSERT INTO submission_attempts (id, network, tx_ids_json, flow, status, created_at)
            VALUES (${`SUB-${network}`}, ${network}, '[]', 'send', 'open', 1)
        `)
    }
}

const countRows = async (db: Database, table: string): Promise<number> => {
    const [[count]] = await db.values<[number]>(
        sql.raw(`SELECT COUNT(*) FROM ${table}`),
    )
    return count
}

const columnNames = async (db: Database, table: string): Promise<string[]> => {
    const rows = await db.values<[number, string]>(
        sql.raw(`SELECT cid, name FROM pragma_table_info('${table}')`),
    )
    return rows.map(([, name]) => name)
}

describe('text asset id migration', () => {
    let teardown: (() => void) | undefined

    afterEach(() => {
        teardown?.()
        teardown = undefined
    })

    const createCachedDatabase = async (
        options?: Parameters<typeof createTestDatabase>[0],
    ): Promise<Database> => {
        const test = createTestDatabase(options)
        teardown = test.teardown
        await runMigrations(test.db, migrationsBefore(REBUILD_TAG))
        await seedCachedRows(test.db)
        return test.db
    }

    it('empties the asset caches and keeps balances and history', async () => {
        const db = await createCachedDatabase()

        await runMigrations(db, migrations)

        for (const table of REBUILT_TABLES) {
            expect(await countRows(db, table)).toBe(0)
        }
        expect(
            await db.values<[string, string]>(sql`
                SELECT network, algo_balance FROM account_balances ORDER BY network
            `),
        ).toEqual([
            ['algorand/mainnet', '12.5'],
            ['algorand/testnet', '12.5'],
        ])
        expect(
            await db.values<[string]>(sql`
                SELECT asset_id FROM account_transactions ORDER BY network
            `),
        ).toEqual([['31566704'], ['31566704']])
        expect(await countRows(db, 'submission_attempts')).toBe(2)
    })

    it('recreates every column the later migrations added', async () => {
        const db = await createCachedDatabase()

        await runMigrations(db, migrations)

        expect(await columnNames(db, 'account_asset_holdings')).toContain(
            'is_frozen',
        )
        expect(await columnNames(db, 'assets_pera')).toContain('first_seen_at')
    })

    it('takes a holding written after it', async () => {
        const db = await createCachedDatabase()
        await runMigrations(db, migrations)

        await db.run(sql`
            INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, updated_at)
            VALUES ('ADDR', '0', 'algorand/mainnet', '5', 1)
        `)

        expect(await countRows(db, 'account_asset_holdings')).toBe(1)
    })

    describe('when a statement times out', () => {
        class FakeTimeoutError extends Error {}

        afterEach(() => {
            resetDatabase()
        })

        it('clears the cache, keeps the submission ledger and finishes the rebuild', async () => {
            let isArmed = false
            const db = await createCachedDatabase({
                beforeExec: statement => {
                    if (
                        isArmed &&
                        statement.startsWith('DROP TABLE `assets_pera`')
                    ) {
                        isArmed = false
                        throw new FakeTimeoutError('timed out')
                    }
                },
            })
            isArmed = true
            const onReset = vi.fn()
            const service = {
                getDatabase: async () => db,
            } as unknown as DatabaseService

            await initializeDatabase(service, {
                recovery: {
                    isRecoverable: error =>
                        error instanceof Error &&
                        error.cause instanceof FakeTimeoutError,
                    onReset,
                },
            })

            for (const table of REBUILT_TABLES) {
                expect(await countRows(db, table)).toBe(0)
            }
            expect(await countRows(db, 'submission_attempts')).toBe(2)
            expect(onReset).toHaveBeenCalledExactlyOnceWith(REBUILD_TAG)
        })
    })
})
