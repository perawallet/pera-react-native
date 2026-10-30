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
    assetsChainAdapters,
    upsertAssets,
    upsertAssetPrices,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    FAKE_NATIVE_ASSET,
    fakeAssetsAdapter,
} from '@perawallet/wallet-core-assets/testing'
import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { refreshAccountHoldings } from '../holdingsRepository'
import {
    getAccountPortfolioTotals,
    getAccountFundedNetworks,
} from '../portfolioQueries'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const
const TESTNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'testnet',
} as const
// ChainId is a closed union, so the second native asset rides on Ethereum's id.
const FIXTURE_CHAIN_ID = 'ethereum'
const FIXTURE_SCOPE: ChainScope = {
    chainId: FIXTURE_CHAIN_ID,
    networkId: 'mainnet',
}

// An 18-decimal native asset whose id is not Algorand's.
const FIXTURE_NATIVE: PeraAsset = {
    ...FAKE_NATIVE_ASSET,
    assetId: 'native',
    decimals: 18,
}

describe('account portfolio queries', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                chainId: FIXTURE_CHAIN_ID,
                getNativeAsset: () => FIXTURE_NATIVE,
            }),
        )
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
                scope: MAINNET_SCOPE,
                holdings: [
                    { assetId: '0', amount: new Decimal(5_000_000) },
                    { assetId: '100', amount: new Decimal(2_000_000) },
                    { assetId: '200', amount: new Decimal(1_000_000) },
                    { assetId: '300', amount: new Decimal(0) },
                ],
            })
            await upsertAssets({
                db,
                scope: MAINNET_SCOPE,
                items: [
                    richAsset('0', 'Algo'),
                    richAsset('100', 'Banana'),
                    richAsset('200', 'Apple'),
                    richAsset('300', 'Zebra', { favorited: true }),
                ],
            })
            await upsertAssetPrices({
                db,
                scope: MAINNET_SCOPE,
                prices: [
                    { assetId: '0', usdPrice: new Decimal('0.2') },
                    { assetId: '100', usdPrice: new Decimal('1') },
                    { assetId: '200', usdPrice: new Decimal('3') },
                    { assetId: '300', usdPrice: new Decimal('0') },
                ],
            })
        })

        it('splits the native amount and price from the non-native USD value', async () => {
            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            expect(totals.holdingsCount).toBe(4)
            // 5_000_000 base units at 6 decimals → 5, no price needed.
            expect(totals.nativeAmount).toEqual(new Decimal(5))
            expect(totals.nativeUsdPrice).toEqual(new Decimal('0.2'))
            // Non-native: 100→2*$1=2, 200→1*$3=3, 300→0 ⇒ 5 USD.
            expect(totals.nonNativeUsdValue.toNumber()).toBeCloseTo(5, 6)
            // All four assets have metadata.
            expect(totals.missingMetadataCount).toBe(0)
        })

        it('reports no native amount or price for an account with no native row', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
                holdings: [{ assetId: '100', amount: new Decimal(1_000_000) }],
            })

            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
            })

            expect(totals.nativeAmount).toEqual(new Decimal(0))
            expect(totals.nativeUsdPrice).toBeNull()
            expect(totals.nonNativeUsdValue.toNumber()).toBeCloseTo(1, 6)
        })

        it("takes each scope's own native asset when one address holds on two chains", async () => {
            const token: PeraAsset = { ...richAsset('tok', 'Token') }
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
                holdings: [
                    // 1.5 whole units at 18 decimals; beyond 2^53 base units.
                    {
                        assetId: 'native',
                        amount: new Decimal('1500000000000000000'),
                    },
                    { assetId: 'tok', amount: new Decimal(3_000_000) },
                ],
            })
            await upsertAssets({
                db,
                scope: FIXTURE_SCOPE,
                items: [FIXTURE_NATIVE, token],
            })
            await upsertAssetPrices({
                db,
                scope: FIXTURE_SCOPE,
                prices: [
                    { assetId: 'native', usdPrice: new Decimal('2000') },
                    { assetId: 'tok', usdPrice: new Decimal('4') },
                ],
            })

            const fixture = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
            })
            const algorand = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })

            expect(fixture.nativeAmount).toEqual(new Decimal('1.5'))
            expect(fixture.nativeUsdPrice).toEqual(new Decimal(2000))
            // 'tok': 3 whole units at 6 decimals, $4 each.
            expect(fixture.nonNativeUsdValue.toNumber()).toBeCloseTo(12, 6)
            expect(fixture.holdingsCount).toBe(2)
            expect(algorand.nativeAmount).toEqual(new Decimal(5))
            expect(algorand.holdingsCount).toBe(4)
        })

        it('counts held assets still missing metadata', async () => {
            // Add a holding with no asset row (metadata not synced yet).
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
                prices: [{ assetId: '999', usdPrice: new Decimal('2') }],
            })

            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
            })
            // Unchanged from the fully-enriched case: '999' drops out until
            // its metadata lands (and missingMetadataCount flags the gap).
            expect(totals.nonNativeUsdValue.toNumber()).toBeCloseTo(5, 6)
            expect(totals.missingMetadataCount).toBe(1)
        })
        it('adds nothing for an unpriced collectible and counts its metadata as present', async () => {
            const collectible: PeraAsset = {
                assetId: 'contract/7',
                decimals: 0,
                creator: { address: 'contract' },
                totalSupply: new Decimal(0),
                name: 'Ape #7',
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    type: PeraAssetType.collectible,
                    isUnique: false,
                },
            }
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
                holdings: [
                    { assetId: 'native', amount: new Decimal(0) },
                    { assetId: 'contract/7', amount: new Decimal(3) },
                ],
            })
            await upsertAssets({
                db,
                scope: FIXTURE_SCOPE,
                items: [FIXTURE_NATIVE, collectible],
            })

            const totals = await getAccountPortfolioTotals({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
            })

            expect(totals.nonNativeUsdValue.isZero()).toBe(true)
            expect(totals.missingMetadataCount).toBe(0)
        })
    })

    describe('getAccountFundedNetworks', () => {
        it('reports every network holding ALGO, not just one', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [{ assetId: '0', amount: 0n }],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: TESTNET_SCOPE,
                holdings: [{ assetId: '0', amount: 5_000_000n }],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
                chainId: 'algorand',
            })

            expect(funded).toEqual(['algorand/testnet'])
        })

        it("does not count another chain's holdings at the same address", async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
                holdings: [{ assetId: 'native', amount: new Decimal(5) }],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [{ assetId: 'native', amount: new Decimal(5) }],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
                chainId: FIXTURE_CHAIN_ID,
            })

            expect(funded).toEqual([`${FIXTURE_CHAIN_ID}/mainnet`])
        })

        it('counts a non-native holding, once per network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: FIXTURE_SCOPE,
                holdings: [
                    { assetId: 'native', amount: new Decimal(0) },
                    { assetId: 'token-a', amount: new Decimal(7) },
                    { assetId: 'token-b', amount: new Decimal(3) },
                ],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
                chainId: FIXTURE_CHAIN_ID,
            })

            expect(funded).toEqual([`${FIXTURE_CHAIN_ID}/mainnet`])
        })

        it('ignores zero holdings and other accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [
                    { assetId: '0', amount: 0n },
                    { assetId: '100', amount: 0n },
                ],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
                holdings: [{ assetId: '0', amount: 1n }],
            })

            const funded = await getAccountFundedNetworks({
                db,
                accountAddress: 'ADDR1',
                chainId: 'algorand',
            })

            expect(funded).toEqual([])
        })
    })
})
