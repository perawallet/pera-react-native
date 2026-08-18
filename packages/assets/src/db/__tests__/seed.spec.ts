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
import { Networks } from '@perawallet/wallet-core-config'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'

import {
    getAssetsByIds,
    upsertAssets,
    updateAssetPeraMetadata,
    getAssetPeraMetadata,
} from '../repository'
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

    // Asserts EVERY network in `Networks`, not a hand-picked pair. The seed
    // used to name mainnet and testnet literally and this test mirrored it, so
    // both went stale the moment betanet and the custom slot were added — the
    // ALGO row was missing there and `InputScreen` (which gates on `!asset`)
    // spun forever, making Send unusable. Driving the assertion off the enum
    // means adding a network fails here until it is seeded.
    it('seeds ALGO into every network', async () => {
        await seedAlgoAsset(db)

        const networks = Object.values(Networks)
        expect(networks.length).toBeGreaterThan(2)

        for (const network of networks) {
            const rows = await getAssetsByIds({
                db,
                assetIds: [ALGO_ASSET_ID],
                network,
            })

            expect(rows, `ALGO must be seeded for ${network}`).toHaveLength(1)
            expect(rows[0].assetId).toBe(ALGO_ASSET_ID)
            expect(rows[0].name).toBe('Algo')
            expect(rows[0].unitName).toBe('ALGO')
            expect(rows[0].decimals).toBe(6)
        }
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

    it('preserves device-local metadata across a re-seed (app restart)', async () => {
        // The seed runs on every bootstrap, but favorites and price alerts are
        // device-local state it must not assert — PERA-4904: favoriting ALGO
        // then force-closing removed the favorite.
        await seedAlgoAsset(db)

        await updateAssetPeraMetadata({
            db,
            assetId: ALGO_ASSET_ID,
            network: 'mainnet',
            updates: { isFavorited: true, isPriceAlertEnabled: true },
        })

        await seedAlgoAsset(db)

        const meta = await getAssetPeraMetadata({
            db,
            assetId: ALGO_ASSET_ID,
            network: 'mainnet',
        })
        expect(meta?.isFavorited).toBe(true)
        expect(meta?.isPriceAlertEnabled).toBe(true)
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
