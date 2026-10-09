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
import { runMigrations, type MigrationConfig } from '../migrator'
import { migrations } from '../migrations'
import { createTestDatabase } from '../test-utils'
import type { DatabaseService } from '@perawallet/wallet-extension-platform'
import { initializeDatabase, resetDatabase, type Database } from '../database'

const BACKFILL_TAG = '0008_scope_key_network'

const LEGACY_NETWORKS = ['mainnet', 'testnet', 'betanet', 'custom'] as const

const NETWORK_TABLES = [
    'account_asset_holdings',
    'account_balances',
    'account_transactions',
    'transactions',
    'assets_node',
    'assets_pera',
    'asset_prices',
    'asset_price_misses',
    'nfd_cache',
    'submission_attempts',
] as const

const HOLDINGS_PER_NETWORK = 2_500
const INSERT_CHUNK = 500

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

// Later migrations rebuild some of these tables, so the assertions stop here.
const migrationsThrough = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t <= tag))

const seedLegacyRows = async (db: Database): Promise<void> => {
    for (const network of LEGACY_NETWORKS) {
        for (
            let start = 0;
            start < HOLDINGS_PER_NETWORK;
            start += INSERT_CHUNK
        ) {
            const values = Array.from(
                { length: INSERT_CHUNK },
                (_, i) =>
                    `('ADDR', '${start + i}', '${network}', '${start + i}', 1)`,
            ).join(', ')
            await db.run(
                sql.raw(
                    `INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, updated_at) VALUES ${values}`,
                ),
            )
        }
        await db.run(sql`
            INSERT INTO account_balances (account_address, network, algo_balance, updated_at)
            VALUES ('ADDR', ${network}, '12.5', 1)
        `)
        await db.run(sql`
            INSERT INTO account_transactions (account_address, transaction_id, network, round_time)
            VALUES ('ADDR', ${`TX-${network}`}, ${network}, 1)
        `)
        await db.run(sql`
            INSERT INTO transactions (id, network, tx_type, sender, confirmed_round, round_time, fee, updated_at)
            VALUES (${`TX-${network}`}, ${network}, 'pay', 'ADDR', 1, 1, '1000', 1)
        `)
        await db.run(sql`
            INSERT INTO assets_node (asset_id, network, updated_at) VALUES ('7', ${network}, 1)
        `)
        await db.run(sql`
            INSERT INTO assets_pera (asset_id, network, updated_at) VALUES ('7', ${network}, 1)
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
            INSERT INTO nfd_cache (address, network, name, updated_at)
            VALUES ('ADDR', ${network}, 'pera.algo', 1)
        `)
        await db.run(sql`
            INSERT INTO submission_attempts (id, network, tx_ids_json, flow, status, created_at)
            VALUES (${`SUB-${network}`}, ${network}, '[]', 'send', 'open', 1)
        `)
    }
}

const countByNetwork = async (
    db: Database,
    table: string,
): Promise<Record<string, number>> => {
    const rows = await db.values<[string, number]>(
        sql.raw(
            `SELECT network, COUNT(*) FROM ${table} GROUP BY network ORDER BY network`,
        ),
    )
    return Object.fromEntries(rows)
}

const totalChanges = async (db: Database): Promise<number> => {
    const [[changes]] = await db.values<[number]>(sql`SELECT total_changes()`)
    return changes
}

const backfillStatements = (): string[] =>
    migrations[BACKFILL_TAG]
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0)

describe('scope key backfill migration', () => {
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    const createLegacyDatabase = async (): Promise<Database> => {
        const test = createTestDatabase()
        teardown = test.teardown
        await runMigrations(test.db, migrationsBefore(BACKFILL_TAG))
        await seedLegacyRows(test.db)
        return test.db
    }

    it('rewrites every legacy network of every table to its scope key', async () => {
        const db = await createLegacyDatabase()

        await runMigrations(db, migrationsThrough(BACKFILL_TAG))

        for (const table of NETWORK_TABLES) {
            const expectedPerNetwork =
                table === 'account_asset_holdings' ? HOLDINGS_PER_NETWORK : 1
            expect(await countByNetwork(db, table)).toEqual(
                Object.fromEntries(
                    LEGACY_NETWORKS.map(network => [
                        `algorand/${network}`,
                        expectedPerNetwork,
                    ]).sort(([a], [b]) => String(a).localeCompare(String(b))),
                ),
            )
        }
    })

    it('leaves every other column as it was', async () => {
        const db = await createLegacyDatabase()

        await runMigrations(db, migrationsThrough(BACKFILL_TAG))

        const [[amount]] = await db.values<[string]>(sql`
            SELECT amount FROM account_asset_holdings
            WHERE network = 'algorand/testnet' AND asset_id = '1234'
        `)
        const [[balance]] = await db.values<[string]>(sql`
            SELECT algo_balance FROM account_balances WHERE network = 'algorand/custom'
        `)
        const [[price]] = await db.values<[string]>(sql`
            SELECT usd_price FROM asset_prices WHERE network = 'algorand/mainnet'
        `)
        expect(amount).toBe('1234')
        expect(balance).toBe('12.5')
        expect(price).toBe('0.25')
    })

    it('indexes the transactions network column', async () => {
        const db = await createLegacyDatabase()

        await runMigrations(db, migrationsThrough(BACKFILL_TAG))

        const indexes = await db.values<[string]>(sql`
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND tbl_name = 'transactions'
        `)
        expect(indexes.flat()).toContain('transactions_network_idx')
    })

    it('changes zero rows when its statements run a second time', async () => {
        const db = await createLegacyDatabase()
        await runMigrations(db, migrationsThrough(BACKFILL_TAG))
        const before = await totalChanges(db)

        for (const statement of backfillStatements()) {
            await db.run(sql.raw(statement))
        }

        expect(await totalChanges(db)).toBe(before)
    })

    describe('when a statement times out', () => {
        class FakeTimeoutError extends Error {}

        afterEach(() => {
            resetDatabase()
        })

        it('clears the cache, keeps the submission ledger and finishes the backfill', async () => {
            let isArmed = false
            const test = createTestDatabase({
                beforeExec: statement => {
                    if (
                        isArmed &&
                        statement.startsWith('UPDATE `transactions`')
                    ) {
                        isArmed = false
                        throw new FakeTimeoutError('timed out')
                    }
                },
            })
            teardown = test.teardown
            await runMigrations(test.db, migrationsBefore(BACKFILL_TAG))
            await seedLegacyRows(test.db)
            isArmed = true
            const onReset = vi.fn()
            const service = {
                getDatabase: async () => test.db,
            } as unknown as DatabaseService

            await initializeDatabase(service, {
                recovery: {
                    isRecoverable: error =>
                        error instanceof Error &&
                        error.cause instanceof FakeTimeoutError,
                    onReset,
                },
            })

            for (const table of NETWORK_TABLES) {
                if (table === 'submission_attempts') continue
                // 0013 drops it.
                if (table === 'account_balances') continue
                expect(await countByNetwork(test.db, table)).toEqual({})
            }
            expect(
                await countByNetwork(test.db, 'submission_attempts'),
            ).toEqual({
                'algorand/betanet': 1,
                'algorand/custom': 1,
                'algorand/mainnet': 1,
                'algorand/testnet': 1,
            })
            expect(onReset).toHaveBeenCalledExactlyOnceWith(BACKFILL_TAG)
        })
    })
})
