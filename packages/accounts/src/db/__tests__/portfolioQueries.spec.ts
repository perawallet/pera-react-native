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
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertAssets,
    upsertAssetPrices,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import { refreshAccountHoldings } from '../holdingsRepository'
import {
    getAccountPortfolioTotals,
    getAccountFundedNetworks,
} from '../portfolioQueries'

describe('account portfolio queries', () => {
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

    describe('portfolio totals', () => {
        // ALGO '0' and three ASAs, all 6 decimals. '300' is favorited.
        // USD values: ALGO 5*0.2=1, '100' 2*1=2, '200' 1*3=3, '300' 0.
        const richAsset = (
            assetId: string,
            name: string,
            opts: { favorited?: boolean } = {},
        ): PeraAsset => ({
            assetId,
            decimals: 6,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1_000_000_000),
            name,
            unitName: name.toUpperCase().slice(0, 4),
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: opts.favorited ?? false,
                isPriceAlertEnabled: false,
                type: PeraAssetType.standard_asset,
            },
        })

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '0', amount: new Decimal(5_000_000) },
                    { assetId: '100', amount: new Decimal(2_000_000) },
                    { assetId: '200', amount: new Decimal(1_000_000) },
                    { assetId: '300', amount: new Decimal(0) },
                ],
            })
            await upsertAssets({
                db,
                network: 'mainnet',
                items: [
                    richAsset('0', 'Algo'),
                    richAsset('100', 'Banana'),
                    richAsset('200', 'Apple'),
                    richAsset('300', 'Zebra', { favorited: true }),
                ],
            })
            await upsertAssetPrices({
                db,
                network: 'mainnet',
                prices: [
                    { assetId: '0', usdPrice: new Decimal('0.2') },
                    { assetId: '100', usdPrice: new Decimal('1') },
                    { assetId: '200', usdPrice: new Decimal('3') },
                    { assetId: '300', usdPrice: new Decimal('0') },
                ],
            })
        })

        it('splits ALGO (price-independent) from non-ALGO USD value', async () => {
            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(totals.holdingsCount).toBe(4)
            // ALGO: 5_000_000 microalgos → 5 ALGO (no price needed).
            expect(totals.algoAmount.toNumber()).toBeCloseTo(5, 6)
            // Non-ALGO: 100→2*$1=2, 200→1*$3=3, 300→0 ⇒ 5 USD.
            expect(totals.nonAlgoUsdValue.toNumber()).toBeCloseTo(5, 6)
            // All four assets have metadata.
            expect(totals.missingMetadataCount).toBe(0)
        })

        it('counts held assets still missing metadata', async () => {
            // Add a holding with no asset row (metadata not synced yet).
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '0', amount: new Decimal(5_000_000) },
                    { assetId: '100', amount: new Decimal(2_000_000) },
                    { assetId: '200', amount: new Decimal(1_000_000) },
                    { assetId: '300', amount: new Decimal(0) },
                    { assetId: '999', amount: new Decimal(10) },
                ],
            })

            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(totals.missingMetadataCount).toBe(1)
        })

        it('a priced holding without metadata contributes 0 to the USD total', async () => {
            // Prices and metadata sync in parallel, so on a fresh import a
            // price can land before its assets_node row. Without decimals we
            // can't scale base units — the row must contribute 0 (matching
            // useAccountBalancesQuery's walk), not amount × price un-scaled.
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '0', amount: new Decimal(5_000_000) },
                    { assetId: '100', amount: new Decimal(2_000_000) },
                    { assetId: '200', amount: new Decimal(1_000_000) },
                    { assetId: '300', amount: new Decimal(0) },
                    { assetId: '999', amount: new Decimal(10_000_000) },
                ],
            })
            await upsertAssetPrices({
                db,
                network: 'mainnet',
                prices: [{ assetId: '999', usdPrice: new Decimal('2') }],
            })

            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            // Unchanged from the fully-enriched case: '999' drops out until
            // its metadata lands (and missingMetadataCount flags the gap).
            expect(totals.nonAlgoUsdValue.toNumber()).toBeCloseTo(5, 6)
            expect(totals.missingMetadataCount).toBe(1)
        })
    })

    describe('getAccountFundedNetworks', () => {
        it('reports every network holding ALGO, not just one', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [{ assetId: '0', amount: 0n }],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'testnet',
                holdings: [{ assetId: '0', amount: 5_000_000n }],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
            })

            expect(funded).toEqual(['testnet'])
        })

        it('ignores ASA holdings and other accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '0', amount: 0n },
                    { assetId: '100', amount: 9_000_000n },
                ],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                holdings: [{ assetId: '0', amount: 1n }],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
            })

            expect(funded).toEqual([])
        })
    })
})
