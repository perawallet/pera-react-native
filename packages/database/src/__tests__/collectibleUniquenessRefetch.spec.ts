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

const TAG = '0020_collectible_uniqueness_refetch'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

const nodeUpdatedAt = async (db: Database): Promise<Record<string, number>> =>
    Object.fromEntries(
        await db.values<[string, number]>(
            sql.raw(
                "SELECT asset_id || '@' || scope, updated_at FROM assets_node ORDER BY asset_id, scope",
            ),
        ),
    )

describe('collectible uniqueness refetch migration', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const test = createTestDatabase()
        db = test.db
        teardown = test.teardown
        await runMigrations(db, migrationsBefore(TAG))
        await db.run(sql`
            INSERT INTO assets_node (asset_id, scope, decimals, total_supply, updated_at)
            VALUES ('1', 'algorand/mainnet', 0, '1', 100),
                   ('1', 'algorand/testnet', 0, '1', 101),
                   ('2', 'algorand/mainnet', 6, '1000', 102)
        `)
        await db.run(sql`
            INSERT INTO assets_pera (asset_id, scope, verification_tier, is_deleted, is_favorited, asset_type, pera_metadata_json, updated_at, first_seen_at)
            VALUES ('1', 'algorand/mainnet', 'unverified', 0, 0, 'collectible', '{}', 200, 200),
                   ('2', 'algorand/mainnet', 'verified', 0, 0, 'asa', '{}', 201, 201)
        `)
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('marks only collectible node rows stale, matched on asset id and scope', async () => {
        expect(await nodeUpdatedAt(db)).toEqual({
            '1@algorand/mainnet': 0,
            '1@algorand/testnet': 101,
            '2@algorand/mainnet': 102,
        })
    })
})
