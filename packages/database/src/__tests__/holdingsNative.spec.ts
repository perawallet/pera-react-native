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
import type { Database } from '../database'

const MIGRATION_TAG = '0014_holdings_native'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

// Later migrations rename the network column, so the assertions stop here.
const migrationsThrough = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t <= tag))

const insertHolding = (
    db: Database,
    assetId: string,
    network: string,
    isFrozen: 0 | 1,
) =>
    db.run(sql`
        INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, is_frozen, updated_at)
        VALUES ('ADDR', ${assetId}, ${network}, '5', ${isFrozen}, 1)
    `)

const nativeOf = async (db: Database, assetId: string, network: string) => {
    const [[native]] = await db.values<[string | null]>(sql`
        SELECT native FROM account_asset_holdings
        WHERE asset_id = ${assetId} AND network = ${network}
    `)
    return native === null ? null : (JSON.parse(native) as unknown)
}

describe('holdings native data migration', () => {
    let teardown: (() => void) | undefined

    afterEach(() => {
        teardown?.()
        teardown = undefined
    })

    it('gives Algorand rows their freeze flag as native data, other chains none, and drops is_frozen', async () => {
        const test = createTestDatabase()
        teardown = test.teardown
        const { db } = test
        await runMigrations(db, migrationsBefore(MIGRATION_TAG))
        await insertHolding(db, '10', 'algorand/mainnet', 1)
        await insertHolding(db, '20', 'algorand/testnet', 0)
        await insertHolding(db, 'native', 'ethereum/mainnet', 0)

        await runMigrations(db, migrationsThrough(MIGRATION_TAG))

        expect(await nativeOf(db, '10', 'algorand/mainnet')).toEqual({
            family: 'algorand',
            isFrozen: true,
        })
        expect(await nativeOf(db, '20', 'algorand/testnet')).toEqual({
            family: 'algorand',
            isFrozen: false,
        })
        expect(await nativeOf(db, 'native', 'ethereum/mainnet')).toBeNull()
        const columns = await db.values<[number, string]>(
            sql.raw(
                `SELECT cid, name FROM pragma_table_info('account_asset_holdings')`,
            ),
        )
        expect(columns.map(([, name]) => name)).not.toContain('is_frozen')
    })
})
