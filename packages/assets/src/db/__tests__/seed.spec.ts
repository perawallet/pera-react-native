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
import { configuredScopes } from '@perawallet/wallet-core-config'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
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
} from '../metadataRepository'
import { assetsChainAdapters } from '../../chain-adapter'
import { FAKE_NATIVE_ASSET } from '../../__tests__/fakeAssetsChain'
import { seedNativeAssets } from '../seed'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

const NATIVE_ID = FAKE_NATIVE_ASSET.assetId

describe('seedNativeAssets', () => {
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

    // Driven off config's rows, not a hand-picked list: a network the seed
    // misses leaves no ALGO row, and `InputScreen` (which gates on `!asset`)
    // spins forever. Adding a row fails here until it is seeded.
    it('seeds the native asset into every network', async () => {
        await seedNativeAssets(db)

        const scopes = configuredScopes().filter(
            scope => scope.chainId === LEGACY_CHAIN_ID,
        )
        expect(scopes.length).toBeGreaterThan(2)

        for (const scope of scopes) {
            const network = scope.networkId
            const rows = await getAssetsByIds({
                db,
                assetIds: [NATIVE_ID],
                scope,
            })

            expect(
                rows,
                `the native asset must be seeded for ${network}`,
            ).toHaveLength(1)
            expect(rows[0].assetId).toBe(NATIVE_ID)
            expect(rows[0].name).toBe('Algo')
            expect(rows[0].unitName).toBe('ALGO')
            expect(rows[0].decimals).toBe(6)
        }
    })

    it('is idempotent — running twice does not duplicate', async () => {
        await seedNativeAssets(db)
        await seedNativeAssets(db)

        const result = await getAssetsByIds({
            db,
            assetIds: [NATIVE_ID],
            scope: MAINNET_SCOPE,
        })

        expect(result).toHaveLength(1)
    })

    it('preserves device-local metadata across a re-seed (app restart)', async () => {
        // The seed runs on every bootstrap, but favorites and price alerts are
        // device-local state it must not assert —: favoriting ALGO
        // then force-closing removed the favorite.
        await seedNativeAssets(db)

        await updateAssetPeraMetadata({
            db,
            assetId: NATIVE_ID,
            scope: MAINNET_SCOPE,
            updates: { isFavorited: true, isPriceAlertEnabled: true },
        })

        await seedNativeAssets(db)

        const meta = await getAssetPeraMetadata({
            db,
            assetId: NATIVE_ID,
            scope: MAINNET_SCOPE,
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
            items: [{ ...FAKE_NATIVE_ASSET, totalSupply: new Decimal('1e19') }],
            scope: MAINNET_SCOPE,
        })

        await seedNativeAssets(db)

        const [algo] = await getAssetsByIds({
            db,
            assetIds: [NATIVE_ID],
            scope: MAINNET_SCOPE,
        })

        expect(algo.totalSupply.toFixed()).toBe('10000000000000000')
    })

    it('rejects when no assets adapter is registered', async () => {
        assetsChainAdapters.reset()

        await expect(seedNativeAssets(db)).rejects.toBeInstanceOf(
            ChainAdapterNotRegisteredError,
        )
    })
})
