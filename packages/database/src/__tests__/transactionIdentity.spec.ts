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

const IDENTITY_TAG = '0009_transaction_identity'

const SCOPES = ['algorand/mainnet', 'algorand/testnet'] as const

const TRANSACTIONS_PER_SCOPE = 2_500
const INSERT_CHUNK = 500

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

// Ids are unique across scopes: the key before this migration is the id alone.
const seedTransactions = async (db: Database): Promise<void> => {
    for (const network of SCOPES) {
        for (
            let start = 0;
            start < TRANSACTIONS_PER_SCOPE;
            start += INSERT_CHUNK
        ) {
            const indexes = Array.from(
                { length: INSERT_CHUNK },
                (_, i) => start + i,
            )
            const transactions = indexes
                .map(
                    i =>
                        `('${network}-TX-${i}', '${network}', 'axfer', 'SENDER', 'ASND', 'RECEIVER', ${i + 1}, ${1_700_000_000 + i}, '1000', 'GROUP', '${i}', 'CLOSE', '7', '12', 2, '{"assetId":"31566704"}', '{"amountIn":"1"}', '{"title":"t"}', '[]', 5)`,
                )
                .join(', ')
            await db.run(
                sql.raw(
                    `INSERT INTO transactions (id, network, tx_type, sender, asset_sender, receiver, confirmed_round, round_time, fee, group_id, amount, close_to, close_amount, application_id, inner_transaction_count, asset_json, swap_group_detail_json, interpreted_meaning_json, balance_impacts_json, updated_at) VALUES ${transactions}`,
                ),
            )
            const links = indexes
                .map(
                    i =>
                        `('ADDR', '${network}-TX-${i}', '${network}', '31566704', ${1_700_000_000 + i})`,
                )
                .join(', ')
            await db.run(
                sql.raw(
                    `INSERT INTO account_transactions (account_address, transaction_id, network, asset_id, round_time) VALUES ${links}`,
                ),
            )
        }
        await db.run(sql`
            INSERT INTO submission_attempts (id, network, tx_ids_json, flow, status, created_at)
            VALUES (${`SUB-${network}`}, ${network}, '[]', 'send', 'open', 1)
        `)
    }
}

const count = async (db: Database, query: string): Promise<number> => {
    const [[value]] = await db.values<[number]>(sql.raw(query))
    return value
}

describe('transaction identity migration', () => {
    let teardown: () => void

    afterEach(() => {
        teardown?.()
    })

    const createSeededDatabase = async (): Promise<Database> => {
        const test = createTestDatabase()
        teardown = test.teardown
        await runMigrations(test.db, migrationsBefore(IDENTITY_TAG))
        await seedTransactions(test.db)
        return test.db
    }

    it('keeps every cached row and marks each transaction confirmed', async () => {
        const db = await createSeededDatabase()

        await runMigrations(db, migrations)

        const total = TRANSACTIONS_PER_SCOPE * SCOPES.length
        expect(await count(db, 'SELECT COUNT(*) FROM transactions')).toBe(total)
        expect(
            await count(db, 'SELECT COUNT(*) FROM account_transactions'),
        ).toBe(total)
        expect(
            await count(
                db,
                "SELECT COUNT(*) FROM transactions WHERE status = 'confirmed'",
            ),
        ).toBe(total)
    })

    it('leaves every other column as it was', async () => {
        const db = await createSeededDatabase()

        await runMigrations(db, migrations)

        const [row] = await db.values(sql`
            SELECT id, network, tx_type, sender, asset_sender, receiver, confirmed_round,
                round_time, fee, group_id, amount, close_to, close_amount, application_id,
                inner_transaction_count, asset_json, swap_group_detail_json,
                interpreted_meaning_json, balance_impacts_json, updated_at
            FROM transactions WHERE id = 'algorand/testnet-TX-1234'
        `)
        expect(row).toEqual([
            'algorand/testnet-TX-1234',
            'algorand/testnet',
            'axfer',
            'SENDER',
            'ASND',
            'RECEIVER',
            1235,
            1_700_001_234,
            '1000',
            'GROUP',
            '1234',
            'CLOSE',
            '7',
            '12',
            2,
            '{"assetId":"31566704"}',
            '{"amountIn":"1"}',
            '{"title":"t"}',
            '[]',
            5,
        ])
        const [link] = await db.values(sql`
            SELECT account_address, network, asset_id, round_time
            FROM account_transactions WHERE transaction_id = 'algorand/mainnet-TX-42'
        `)
        expect(link).toEqual([
            'ADDR',
            'algorand/mainnet',
            '31566704',
            1_700_000_042,
        ])
    })

    it('accepts an id that another scope already holds', async () => {
        const db = await createSeededDatabase()
        await runMigrations(db, migrations)

        await db.run(sql`
            INSERT INTO transactions (id, network, tx_type, sender, confirmed_round, round_time, fee, updated_at)
            VALUES ('algorand/mainnet-TX-1', 'algorand/testnet', 'pay', 'ADDR', 1, 1, '1000', 1)
        `)

        expect(
            await count(
                db,
                "SELECT COUNT(*) FROM transactions WHERE id = 'algorand/mainnet-TX-1'",
            ),
        ).toBe(2)
    })

    it('stores a transaction with no round yet', async () => {
        const db = await createSeededDatabase()
        await runMigrations(db, migrations)

        await db.run(sql`
            INSERT INTO transactions (id, network, tx_type, sender, fee, status, updated_at)
            VALUES ('PENDING', 'algorand/mainnet', 'pay', 'ADDR', '1000', 'pending', 1)
        `)
        await db.run(sql`
            INSERT INTO account_transactions (account_address, transaction_id, network)
            VALUES ('ADDR', 'PENDING', 'algorand/mainnet')
        `)

        const [row] = await db.values(sql`
            SELECT t.status, t.confirmed_round, t.round_time, a.round_time AS link_round_time
            FROM transactions t JOIN account_transactions a
                ON a.transaction_id = t.id AND a.network = t.network
            WHERE t.id = 'PENDING'
        `)
        expect(row).toEqual(['pending', null, null, null])
    })

    it('keeps the network index on the rebuilt table', async () => {
        const db = await createSeededDatabase()

        await runMigrations(db, migrations)

        const indexes = await db.values<[string]>(sql`
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND tbl_name = 'transactions'
        `)
        expect(indexes.flat()).toContain('transactions_network_idx')
    })

    describe('when a statement times out', () => {
        class FakeTimeoutError extends Error {}

        afterEach(() => {
            resetDatabase()
        })

        it('clears the cache, keeps the submission ledger and finishes the rebuild', async () => {
            let isArmed = false
            const test = createTestDatabase({
                beforeExec: statement => {
                    if (
                        isArmed &&
                        statement.startsWith('INSERT INTO `transactions_new`')
                    ) {
                        isArmed = false
                        throw new FakeTimeoutError('timed out')
                    }
                },
            })
            teardown = test.teardown
            await runMigrations(test.db, migrationsBefore(IDENTITY_TAG))
            await seedTransactions(test.db)
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

            expect(
                await count(test.db, 'SELECT COUNT(*) FROM transactions'),
            ).toBe(0)
            expect(
                await count(
                    test.db,
                    'SELECT COUNT(*) FROM account_transactions',
                ),
            ).toBe(0)
            expect(
                await count(
                    test.db,
                    'SELECT COUNT(*) FROM submission_attempts',
                ),
            ).toBe(SCOPES.length)
            await test.db.run(sql`
                INSERT INTO transactions (id, network, tx_type, sender, fee, updated_at)
                VALUES ('SHARED', 'algorand/mainnet', 'pay', 'ADDR', '1000', 1),
                       ('SHARED', 'algorand/testnet', 'pay', 'ADDR', '1000', 1)
            `)
            expect(onReset).toHaveBeenCalledExactlyOnceWith(IDENTITY_TAG)
        })
    })
})
