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

const TAG = '0019_chain_data_scope_columns'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

// A later migration that adds a column would otherwise change every dump.
const migrationsThrough = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t <= tag))

const TABLES = [
    'account_asset_holdings',
    'account_chain_state',
    'assets_node',
    'assets_pera',
    'asset_prices',
    'asset_price_misses',
    'transactions',
    'account_transactions',
    'nfd_cache',
    'submission_attempts',
] as const

type Row = Record<string, unknown>

const columnNames = async (db: Database, table: string): Promise<string[]> =>
    (
        await db.values<[string]>(
            sql.raw(`SELECT name FROM pragma_table_info('${table}')`),
        )
    ).map(([name]) => name)

const dump = async (db: Database, table: string): Promise<Row[]> => {
    const columns = await columnNames(db, table)
    const rows = await db.values<unknown[]>(
        sql.raw(`SELECT * FROM ${table} ORDER BY rowid`),
    )
    return rows.map(values =>
        Object.fromEntries(columns.map((column, i) => [column, values[i]])),
    )
}

const dumpAll = async (db: Database): Promise<Record<string, Row[]>> => {
    const all: Record<string, Row[]> = {}
    for (const table of TABLES) all[table] = await dump(db, table)
    return all
}

const seed = async (db: Database) => {
    await db.run(sql`
        INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, native, updated_at)
        VALUES ('ADDR', '10', 'algorand/mainnet', '5', '{"family":"algorand","isFrozen":true}', 11)
    `)
    await db.run(sql`
        INSERT INTO account_chain_state (account_address, network, native_balance, chain_data, updated_at)
        VALUES ('ADDR', 'algorand/mainnet', '1000', '{"family":"algorand"}', 12)
    `)
    await db.run(sql`
        INSERT INTO assets_node (asset_id, network, decimals, creator_address, total_supply, name, unit_name, url, metadata, updated_at)
        VALUES ('10', 'algorand/mainnet', 6, 'CREATOR', '1000000', 'Token', 'TKN', 'https://x', 'meta', 13),
               ('0xabc', 'ethereum/mainnet', 18, '', '0', 'Eth token', 'ETK', NULL, NULL, 14)
    `)
    await db.run(sql`
        INSERT INTO assets_pera (asset_id, network, verification_tier, is_deleted, is_favorited, asset_type, pera_metadata_json, updated_at, first_seen_at)
        VALUES ('10', 'algorand/mainnet', 'verified', 0, 1, 'asa', '{}', 15, 16)
    `)
    await db.run(sql`
        INSERT INTO asset_prices (asset_id, network, usd_price, updated_at)
        VALUES ('10', 'algorand/mainnet', '1.25', 17)
    `)
    await db.run(sql`
        INSERT INTO asset_price_misses (asset_id, network, attempted_at)
        VALUES ('11', 'algorand/mainnet', 18)
    `)
    await db.run(sql`
        INSERT INTO transactions (id, network, tx_type, sender, fee, chain_data, updated_at)
        VALUES ('TX', 'algorand/mainnet', 'pay', 'ADDR', '1000', '{"algorand":{}}', 19)
    `)
    await db.run(sql`
        INSERT INTO account_transactions (account_address, transaction_id, network, asset_id, round_time)
        VALUES ('ADDR', 'TX', 'algorand/mainnet', '0', 20)
    `)
    await db.run(sql`
        INSERT INTO nfd_cache (address, network, name, image, source, updated_at)
        VALUES ('ADDR', 'algorand/mainnet', 'pera.algo', NULL, 'api', 21)
    `)
    await db.run(sql`
        INSERT INTO submission_attempts (id, network, tx_ids_json, flow, sender, status, last_valid, created_at)
        VALUES ('WINDOWED', 'algorand/mainnet', '["TX1"]', 'pipeline', 'ADDR', 'submitted', 1234, 22),
               ('UNBOUNDED', 'algorand/mainnet', '["TX2"]', 'pipeline', 'ADDR', 'unknown', NULL, 23)
    `)
}

const withScope = ({ network, ...row }: Row): Row => ({
    ...row,
    scope: network,
})

describe('chain data and scope columns migration', () => {
    let db: Database
    let teardown: () => void
    let before: Record<string, Row[]>

    beforeEach(async () => {
        const test = createTestDatabase()
        db = test.db
        teardown = test.teardown
        await runMigrations(db, migrationsBefore(TAG))
        await seed(db)
        before = await dumpAll(db)
        await runMigrations(db, migrationsThrough(TAG))
    })

    afterEach(() => {
        teardown()
    })

    it('keeps every row of the renamed tables, with its network under scope', async () => {
        for (const table of TABLES) {
            if (table === 'assets_node' || table === 'submission_attempts') {
                continue
            }
            expect(await dump(db, table)).toEqual(before[table]!.map(withScope))
        }
    })

    it("moves an Algorand asset's creator into chain_data and gives other chains none", async () => {
        expect(await dump(db, 'assets_node')).toEqual(
            before.assets_node!.map(row => {
                const { creator_address: creator, ...rest } = withScope(row)
                return {
                    ...rest,
                    chain_data:
                        row.network === 'algorand/mainnet'
                            ? JSON.stringify({
                                  family: 'algorand',
                                  creatorAddress: creator,
                              })
                            : null,
                }
            }),
        )
    })

    it("moves an attempt's validity window into chain_data and leaves one without it null", async () => {
        expect(await dump(db, 'submission_attempts')).toEqual(
            before.submission_attempts!.map(row => {
                const { last_valid: lastValid, ...rest } = withScope(row)
                return {
                    ...rest,
                    chain_data:
                        lastValid === null
                            ? null
                            : JSON.stringify({ family: 'algorand', lastValid }),
                }
            }),
        )
    })

    it('leaves no network, creator_address, last_valid or is_frozen column', async () => {
        const columns = await db.values<[string, string]>(sql`
            SELECT m.name, c.name FROM sqlite_master m
            JOIN pragma_table_info(m.name) c
            WHERE m.type = 'table'
        `)

        expect(
            columns.filter(([, name]) =>
                [
                    'network',
                    'creator_address',
                    'last_valid',
                    'is_frozen',
                ].includes(name),
            ),
        ).toEqual([])
    })

    it('indexes transactions by scope', async () => {
        const indexes = await db.values<[string]>(sql`
            SELECT name FROM sqlite_master
            WHERE type = 'index' AND tbl_name = 'transactions'
        `)

        expect(indexes.flat()).toContain('transactions_scope_idx')
        expect(indexes.flat()).not.toContain('transactions_network_idx')
    })

    it('changes nothing on a second cold start', async () => {
        const migrated = await dumpAll(db)

        await runMigrations(db, migrationsThrough(TAG))

        expect(await dumpAll(db)).toEqual(migrated)
        const [[applied]] = await db.values<[number]>(
            sql`SELECT COUNT(*) FROM __drizzle_migrations WHERE tag = ${TAG}`,
        )
        expect(applied).toBe(1)
    })
})
