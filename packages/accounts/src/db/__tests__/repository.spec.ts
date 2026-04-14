/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    refreshAccountHoldings,
    getAccountHoldings,
    insertAssetHolding,
    deleteAssetHoldings,
    upsertAccountBalance,
    getAccountBalance,
    getAllAccountBalances,
    getAllAssetIdsForNetwork,
    getAccountPortfolioValue,
} from '../repository'

describe('account repository', () => {
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

    describe('holdings', () => {
        it('inserts and retrieves holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5000n },
                    { assetId: '200', amount: 300n },
                ],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })

        it('replaces all holdings on upsert', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5000n },
                    { assetId: '200', amount: 300n },
                ],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 999n }],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
            expect(result[0].amount).toEqual(new Decimal(999))
        })

        it('handles empty holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n }],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })

        it('isolates holdings by account and network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '200', amount: 20n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 30n }],
                network: 'testnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'testnet',
                }),
            ).toHaveLength(0)
        })

        it('returns empty array for unknown account', async () => {
            const result = await getAccountHoldings({
                db,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })
    })

    describe('getAccountHoldings filters', () => {
        // Holdings layout used by the filter tests below:
        //   '100' - standard asset, non-zero amount
        //   '200' - standard asset, zero amount
        //   '300' - collectible (NFT), non-zero amount (owned NFT)
        //   '400' - collectible (NFT), zero amount (opted-in but not owned)
        //   '500' - unknown asset (no row in assets_pera) — should always be kept
        //           when filters do not explicitly exclude it
        const makeAsset = (
            assetId: string,
            type: (typeof PeraAssetType)[keyof typeof PeraAssetType],
        ): PeraAsset => ({
            assetId,
            decimals: 0,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1),
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                type,
            },
        })

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(50) },
                    { assetId: '200', amount: new Decimal(0) },
                    { assetId: '300', amount: new Decimal(1) },
                    { assetId: '400', amount: new Decimal(0) },
                    { assetId: '500', amount: new Decimal(0) },
                ],
                network: 'mainnet',
            })
            await upsertAssets({
                db,
                items: [
                    makeAsset('100', PeraAssetType.standard_asset),
                    makeAsset('200', PeraAssetType.standard_asset),
                    makeAsset('300', PeraAssetType.collectible),
                    makeAsset('400', PeraAssetType.collectible),
                ],
                network: 'mainnet',
            })
        })

        const idsOf = async (filters: Record<string, unknown>) => {
            const rows = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                ...filters,
            })
            return rows.map(r => r.assetId).sort()
        }

        it('returns all holdings when no filters are provided', async () => {
            expect(await idsOf({})).toEqual(['100', '200', '300', '400', '500'])
        })

        it('hideZeroBalance excludes rows with amount equal to zero', async () => {
            expect(await idsOf({ hideZeroBalance: true })).toEqual([
                '100',
                '300',
            ])
        })

        it('hideNfts excludes all collectibles but keeps unknown asset types', async () => {
            expect(await idsOf({ hideNfts: true })).toEqual([
                '100',
                '200',
                '500',
            ])
        })

        it('hideOptedInNfts excludes only zero-balance collectibles', async () => {
            // Owned NFT '300' is kept, opted-in '400' is dropped, unknown '500' kept.
            expect(await idsOf({ hideOptedInNfts: true })).toEqual([
                '100',
                '200',
                '300',
                '500',
            ])
        })

        it('combines hideZeroBalance with hideNfts', async () => {
            expect(
                await idsOf({ hideZeroBalance: true, hideNfts: true }),
            ).toEqual(['100'])
        })

        it('combines hideZeroBalance with hideOptedInNfts', async () => {
            // hideZeroBalance drops '200', '400', '500'; hideOptedInNfts is
            // already covered by hideZeroBalance for collectibles.
            expect(
                await idsOf({
                    hideZeroBalance: true,
                    hideOptedInNfts: true,
                }),
            ).toEqual(['100', '300'])
        })

        it('excludeAssetTypes still works for arbitrary type lists', async () => {
            expect(
                await idsOf({
                    excludeAssetTypes: [PeraAssetType.standard_asset],
                }),
            ).toEqual(['300', '400', '500'])
        })
    })

    describe('insertAssetHolding', () => {
        it('inserts a new holding with zero amount', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(new Decimal(0))
        })

        it('does not overwrite existing holding on conflict', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 500n }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(500))
        })

        it('adds alongside existing holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '200',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })
    })

    describe('deleteAssetHoldings', () => {
        it('deletes specified asset holdings', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 0n },
                    { assetId: '200', amount: 0n },
                    { assetId: '300', amount: 0n },
                ],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100', '200'],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
        })

        it('does not affect other accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })

        it('does not affect other networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'testnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
        })

        it('handles empty assetIds array', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 0n }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                db,
                accountAddress: 'ADDR1',
                assetIds: [],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })
    })

    describe('balances', () => {
        it('inserts a new balance', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 5000000n,
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: 100000n,
                status: 'Online',
                authAddress: null,
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(new Decimal(5000000))
            expect(result!.totalAssetsOptedIn).toBe(3)
            expect(result!.minBalance).toEqual(new Decimal(100000))
            expect(result!.status).toBe('Online')
        })

        it('updates an existing balance on conflict', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 5000000n,
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: 100000n,
                status: 'Online',
                authAddress: null,
            })

            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 9000000n,
                totalAssetsOptedIn: 5,
                totalCreatedAssets: 2,
                totalAppsOptedIn: 3,
                minBalance: 200000n,
                status: 'Offline',
                authAddress: 'AUTH1',
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(new Decimal(9000000))
            expect(result!.totalAssetsOptedIn).toBe(5)
            expect(result!.minBalance).toEqual(new Decimal(200000))
            expect(result!.status).toBe('Offline')
            expect(result!.authAddress).toBe('AUTH1')
        })

        it('returns undefined for unknown account', async () => {
            const result = await getAccountBalance({
                db,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result).toBeUndefined()
        })

        it('retrieves all balances for multiple addresses', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: 1000n,
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: 0n,
                status: 'Offline',
                authAddress: null,
            })
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                algoBalance: 2000n,
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: 0n,
                status: 'Offline',
                authAddress: null,
            })

            const result = await getAllAccountBalances({
                db,
                accountAddresses: ['ADDR1', 'ADDR2'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
        })
    })

    describe('getAllAssetIdsForNetwork', () => {
        it('returns distinct asset IDs across accounts', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 10n },
                    { assetId: '200', amount: 20n },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [
                    { assetId: '200', amount: 30n },
                    { assetId: '300', amount: 40n },
                ],
                network: 'mainnet',
            })

            const result = await getAllAssetIdsForNetwork({
                db,
                network: 'mainnet',
            })

            expect(result.sort()).toEqual(['100', '200', '300'])
        })
    })

    describe('getAccountPortfolioValue', () => {
        const makeAsset = (
            assetId: string,
            decimals: number,
            type: (typeof PeraAssetType)[keyof typeof PeraAssetType] = PeraAssetType.standard_asset,
        ): PeraAsset => ({
            assetId,
            decimals,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1),
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                isFavorited: false,
                isPriceAlertEnabled: false,
                type,
            },
        })

        beforeEach(async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: new Decimal(5),
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: new Decimal(0),
                status: 'Online',
                authAddress: null,
            })
            await upsertAssets({
                db,
                items: [
                    makeAsset('456', 2), // token with 2 decimals
                    makeAsset('789', 6), // token with 6 decimals
                    makeAsset('999', 0, PeraAssetType.collectible),
                ],
                network: 'mainnet',
            })
            await upsertAssetPrices({
                db,
                prices: [
                    { assetId: '0', usdPrice: new Decimal(2) },
                    { assetId: '456', usdPrice: new Decimal(10) },
                    { assetId: '789', usdPrice: new Decimal('0.5') },
                    { assetId: '999', usdPrice: new Decimal(100) },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '456', amount: new Decimal(1000) }, // 10 tokens
                    { assetId: '789', amount: new Decimal(2000000) }, // 2 tokens
                    { assetId: '999', amount: new Decimal(1) }, // 1 NFT
                ],
                network: 'mainnet',
            })
        })

        it('aggregates algo balance, ASA USD total, and ALGO price in one query', async () => {
            const result = await getAccountPortfolioValue({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result.algoBalance).toEqual(new Decimal(5))
            expect(result.algoUsdPrice).toEqual(new Decimal(2))
            // 10 * $10 + 2 * $0.50 + 1 * $100 = $201
            expect(result.asaUsdTotal.toNumber()).toBeCloseTo(201, 10)
        })

        it('excludes NFTs when hideNfts filter is applied', async () => {
            const result = await getAccountPortfolioValue({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                hideNfts: true,
            })

            // 10 * $10 + 2 * $0.50 = $101, NFT contribution removed
            expect(result.asaUsdTotal.toNumber()).toBeCloseTo(101, 10)
        })

        it('drops holdings without a price row from the sum', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '456', amount: new Decimal(1000) },
                    { assetId: '321', amount: new Decimal(50000) }, // no price row
                ],
                network: 'mainnet',
            })

            const result = await getAccountPortfolioValue({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            // Only priced '456' contributes: 10 * $10 = $100
            expect(result.asaUsdTotal.toNumber()).toBeCloseTo(100, 10)
        })

        it('returns zeros for an unknown account', async () => {
            const result = await getAccountPortfolioValue({
                db,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result.algoBalance).toEqual(new Decimal(0))
            expect(result.asaUsdTotal).toEqual(new Decimal(0))
        })

        it('returns zero ALGO price when asset_prices has no ALGO row', async () => {
            const result = await getAccountPortfolioValue({
                db,
                accountAddress: 'ADDR1',
                network: 'testnet', // nothing seeded on testnet
            })

            expect(result.algoUsdPrice).toEqual(new Decimal(0))
            expect(result.asaUsdTotal).toEqual(new Decimal(0))
        })
    })
})
