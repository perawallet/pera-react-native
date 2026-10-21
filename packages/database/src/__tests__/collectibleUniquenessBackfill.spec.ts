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

const TAG = '0020_collectible_uniqueness_backfill'

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

const peraMetadata = async (
    db: Database,
): Promise<Record<string, Record<string, unknown>>> =>
    Object.fromEntries(
        (
            await db.values<[string, string]>(
                sql.raw(
                    "SELECT asset_id || '@' || scope, pera_metadata_json FROM assets_pera ORDER BY asset_id, scope",
                ),
            )
        ).map(([key, json]) => [key, JSON.parse(json)]),
    )

describe('collectible uniqueness backfill migration', () => {
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
                   ('1', 'algorand/testnet', 0, '500', 101),
                   ('2', 'algorand/mainnet', 6, '1', 102),
                   ('3', 'algorand/mainnet', 0, '1', 103)
        `)
        await db.run(sql`
            INSERT INTO assets_pera (asset_id, scope, verification_tier, is_deleted, is_favorited, asset_type, pera_metadata_json, updated_at, first_seen_at)
            VALUES ('1', 'algorand/mainnet', 'unverified', 0, 0, 'collectible', '{"collectible":{"title":"One"}}', 200, 200),
                   ('1', 'algorand/testnet', 'unverified', 0, 0, 'collectible', '{}', 201, 201),
                   ('2', 'algorand/mainnet', 'unverified', 0, 0, 'collectible', '{}', 202, 202),
                   ('3', 'algorand/mainnet', 'verified', 0, 0, 'standard_asset', '{}', 203, 203)
        `)
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('sets isUnique on cached collectibles from the supply on the same scope, and leaves other assets alone', async () => {
        expect(await peraMetadata(db)).toEqual({
            '1@algorand/mainnet': {
                collectible: { title: 'One' },
                isUnique: true,
            },
            '1@algorand/testnet': { isUnique: false },
            '2@algorand/mainnet': { isUnique: false },
            '3@algorand/mainnet': {},
        })
    })

    it('does not mark any row stale', async () => {
        const updatedAt = await db.values<[number]>(
            sql.raw(
                'SELECT updated_at FROM assets_node ORDER BY asset_id, scope',
            ),
        )

        expect(updatedAt.map(([value]) => value)).toEqual([100, 101, 102, 103])
    })
})
