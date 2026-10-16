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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    assetsChainAdapters,
    fetchAndPersistPrices,
    getAssetPricesByIds,
    upsertAssets,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    FAKE_NATIVE_ASSET,
    fakeAssetsAdapter,
} from '@perawallet/wallet-core-assets/testing'
import {
    type AssetPrice,
    type AssetRef,
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { refreshAccountHoldings } from '../../db/holdingsRepository'
import { getAccountPortfolioTotals } from '../../db/portfolioQueries'

const testDb = vi.hoisted(() => ({ current: null as Database | null }))

vi.mock('@perawallet/wallet-core-database', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => testDb.current,
}))

// ChainId is a closed union, so the second chain rides on Ethereum's id.
const FIXTURE_SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }

// One instance, as the adapter contract requires: an 18-decimal native asset
// whose id is not Algorand's.
const FIXTURE_NATIVE: PeraAsset = {
    ...FAKE_NATIVE_ASSET,
    assetId: 'native',
    decimals: 18,
}

const TOKEN: PeraAsset = {
    assetId: 'tok',
    name: 'Token',
    unitName: 'TOK',
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal(1_000_000_000),
    peraMetadata: {
        isDeleted: false,
        verificationTier: 'unverified',
        isFavorited: false,
        isPriceAlertEnabled: false,
        type: PeraAssetType.standard_asset,
    },
}

const USD_PRICES: Record<string, string> = { native: '2000', tok: '4' }

describe('pricing a second chain through its assets adapter', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        testDb.current = result.db
        teardown = result.teardown
        await runMigrations(result.db, migrations)

        assetsChainAdapters.reset()
        assetsChainAdapters.register(fakeAssetsAdapter())
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                chainId: 'ethereum',
                getNativeAsset: () => FIXTURE_NATIVE,
                getPrices: async (refs: AssetRef[]): Promise<AssetPrice[]> =>
                    refs.map(assetRef => ({
                        assetRef,
                        usdPrice: new Decimal(USD_PRICES[assetRef.assetId]),
                    })),
            }),
        )

        await refreshAccountHoldings({
            accountAddress: 'ADDR1',
            scope: FIXTURE_SCOPE,
            holdings: [
                // 1.5 whole units at 18 decimals.
                {
                    assetId: 'native',
                    amount: new Decimal('1500000000000000000'),
                },
                // 3 whole units at 6 decimals.
                { assetId: 'tok', amount: new Decimal(3_000_000) },
            ],
        })
        await upsertAssets({
            scope: FIXTURE_SCOPE,
            items: [FIXTURE_NATIVE, TOKEN],
        })
    })

    afterEach(() => {
        assetsChainAdapters.reset()
        teardown()
        testDb.current = null
    })

    it('writes price rows under its own scope only', async () => {
        await fetchAndPersistPrices(['native', 'tok'], FIXTURE_SCOPE)

        const fixtureRows = await getAssetPricesByIds({
            assetIds: ['native', 'tok'],
            scope: FIXTURE_SCOPE,
        })
        const algorandRows = await getAssetPricesByIds({
            assetIds: ['native', 'tok'],
            scope: { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
        })

        expect(
            fixtureRows
                .map(row => [row.assetId, row.usdPrice.toString()])
                .sort(),
        ).toEqual([
            ['native', '2000'],
            ['tok', '4'],
        ])
        expect(algorandRows).toEqual([])
    })

    it("gives the account a non-zero fiat total on that chain's scope", async () => {
        await fetchAndPersistPrices(['native', 'tok'], FIXTURE_SCOPE)

        const totals = await getAccountPortfolioTotals({
            accountAddress: 'ADDR1',
            scope: FIXTURE_SCOPE,
        })

        expect(totals.nativeUsdPrice).toEqual(new Decimal(2000))
        expect(totals.nonNativeUsdValue).toEqual(new Decimal(12))
    })
})
