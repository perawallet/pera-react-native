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

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
    runMigrations,
    migrations,
    type Database,
    type MigrationConfig,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    refreshAccountHoldings,
    getAccountHoldings,
} from '../holdingsRepository'
import { upsertAccountBalance, getAccountBalance } from '../balancesRepository'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')

const HOLDINGS = [
    { assetId: '0', amount: 5_000_000n },
    { assetId: '31566704', amount: 300n },
]

const migrationsBefore = (tag: string): MigrationConfig =>
    Object.fromEntries(Object.entries(migrations).filter(([t]) => t < tag))

describe('holdings across the asset cache rebuild', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrationsBefore('0009_text_asset_ids'))
        await upsertAccountBalance({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
            algoBalance: 5n,
            totalAssetsOptedIn: 1,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: 0n,
            status: 'Offline',
            authAddress: null,
        })
        await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: HOLDINGS,
            scope: MAINNET_SCOPE,
        })
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('keeps the balance row', async () => {
        const balance = await getAccountBalance({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
        })

        expect(balance?.algoBalance.toString()).toBe('5')
    })

    it('reports the next sync of the same holdings as a change, so asset and price syncs run', async () => {
        const isChanged = await refreshAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            holdings: HOLDINGS,
            scope: MAINNET_SCOPE,
        })

        expect(isChanged).toBe(true)
        const holdings = await getAccountHoldings({
            db,
            accountAddress: 'ADDR1',
            scope: MAINNET_SCOPE,
        })
        expect(holdings.map(h => h.assetId).sort()).toEqual(['0', '31566704'])
    })
})
