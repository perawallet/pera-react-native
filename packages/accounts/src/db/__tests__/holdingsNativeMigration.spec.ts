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

import { describe, it, expect, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type MigrationConfig,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { refreshAccountHoldings } from '../holdingsRepository'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

describe('holdings across the native data migration', () => {
    let teardown: (() => void) | undefined

    afterEach(() => {
        teardown?.()
        teardown = undefined
    })

    it('reports the next sync of unchanged holdings as no change, so an upgrade rewrites nothing', async () => {
        const { db, teardown: close } = createTestDatabase()
        teardown = close
        await runMigrations(db, migrationsBefore('0014_holdings_native'))
        const ids = Array.from({ length: 300 }, (_, i) => `${i}`)
        for (const assetId of ids) {
            await db.run(sql`
                INSERT INTO account_asset_holdings (account_address, asset_id, network, amount, is_frozen, updated_at)
                VALUES ('ADDR1', ${assetId}, 'algorand/mainnet', '5', ${assetId === '7' ? 1 : 0}, 1)
            `)
        }
        await runMigrations(db, migrations)

        const isChanged = await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            holdings: ids.map(assetId => ({
                assetId,
                amount: new Decimal(5),
                native: { family: 'algorand', isFrozen: assetId === '7' },
            })),
        })

        expect(isChanged).toBe(false)
    })
})
