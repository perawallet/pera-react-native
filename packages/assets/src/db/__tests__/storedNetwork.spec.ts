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
import { sql } from 'drizzle-orm'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { PeraAsset } from '../../models'
import { updateAssetPeraMetadata, upsertAssets } from '../metadataRepository'
import { recordPriceMisses, upsertAssetPrices } from '../pricesRepository'

const TESTNET_SCOPE = scopeForLegacyNetwork('testnet')

const ASSET: PeraAsset = {
    assetId: '100',
    decimals: 6,
    creator: { address: 'ABC123' },
    totalSupply: new Decimal('1000'),
    peraMetadata: { isDeleted: false, verificationTier: 'verified' },
}

// Every other spec writes and reads through the same encoder, so only a raw
// read catches a writer that stops storing what existing installs hold.
describe('assets repositories store the legacy network value', () => {
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

    const storedNetworks = async (table: string): Promise<string[]> => {
        const rows = (await db.all(
            sql.raw(`select network from ${table}`),
        )) as Array<[string]>
        return rows.map(([network]) => network)
    }

    it('writes the bare network to assets_node and assets_pera', async () => {
        await upsertAssets({ db, items: [ASSET], scope: TESTNET_SCOPE })

        expect(await storedNetworks('assets_node')).toEqual(['testnet'])
        expect(await storedNetworks('assets_pera')).toEqual(['testnet'])
    })

    it('updates the existing legacy row instead of adding a second one', async () => {
        await upsertAssets({ db, items: [ASSET], scope: TESTNET_SCOPE })

        await updateAssetPeraMetadata({
            db,
            assetId: ASSET.assetId,
            scope: TESTNET_SCOPE,
            updates: { isFavorited: true },
        })

        expect(await storedNetworks('assets_pera')).toEqual(['testnet'])
    })

    it('writes the bare network to asset_prices and asset_price_misses', async () => {
        await upsertAssetPrices({
            db,
            prices: [{ assetId: '100', usdPrice: new Decimal('1') }],
            scope: TESTNET_SCOPE,
        })
        await recordPriceMisses({ db, assetIds: ['200'], scope: TESTNET_SCOPE })

        expect(await storedNetworks('asset_prices')).toEqual(['testnet'])
        expect(await storedNetworks('asset_price_misses')).toEqual(['testnet'])
    })
})
