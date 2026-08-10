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
import { Decimal } from 'decimal.js'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'

import { getAssetsByIds, upsertAssets } from '../repository'
import { seedAlgoAsset } from '../seed'
import { ALGO_ASSET } from '../../models'

describe('seedAlgoAsset', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        teardown()
    })

    it('seeds ALGO into both mainnet and testnet', async () => {
        await seedAlgoAsset(db)

        const mainnet = await getAssetsByIds({
            db,
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })
        const testnet = await getAssetsByIds({
            db,
            assetIds: [ALGO_ASSET_ID],
            network: 'testnet',
        })

        expect(mainnet).toHaveLength(1)
        expect(mainnet[0].assetId).toBe(ALGO_ASSET_ID)
        expect(mainnet[0].name).toBe('Algo')
        expect(mainnet[0].unitName).toBe('ALGO')
        expect(mainnet[0].decimals).toBe(6)

        expect(testnet).toHaveLength(1)
        expect(testnet[0].assetId).toBe(ALGO_ASSET_ID)
    })

    it('is idempotent — running twice does not duplicate', async () => {
        await seedAlgoAsset(db)
        await seedAlgoAsset(db)

        const result = await getAssetsByIds({
            db,
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })

        expect(result).toHaveLength(1)
    })

    it('overwrites a stale totalSupply already in the DB', async () => {
        // Installs that ran the 1000x-too-large constant have it persisted;
        // the seed runs on every bootstrap, so it must correct the row rather
        // than leave the stored value alone.
        await upsertAssets({
            db,
            items: [{ ...ALGO_ASSET, totalSupply: new Decimal('1e19') }],
            network: 'mainnet',
        })

        await seedAlgoAsset(db)

        const [algo] = await getAssetsByIds({
            db,
            assetIds: [ALGO_ASSET_ID],
            network: 'mainnet',
        })

        expect(algo.totalSupply.toFixed()).toBe('10000000000000000')
    })
})
