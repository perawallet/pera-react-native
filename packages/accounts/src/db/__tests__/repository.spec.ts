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
    bootstrapTestCollections,
    resetRegistryForTest,
    type CollectionRegistry,
} from '@perawallet/wallet-core-database'
import {
    upsertAssets,
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
} from '../repository'

const dec = (n: number | string): Decimal => new Decimal(n)

describe('account repository', () => {
    let registry: CollectionRegistry

    beforeEach(() => {
        registry = bootstrapTestCollections()
    })

    afterEach(() => {
        resetRegistryForTest()
    })

    describe('holdings', () => {
        it('inserts and retrieves holdings', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: dec(5000) },
                    { assetId: '200', amount: dec(300) },
                ],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.map(r => r.assetId).sort()).toEqual(['100', '200'])
        })

        it('replaces all holdings on upsert', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: dec(5000) },
                    { assetId: '200', amount: dec(300) },
                ],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: dec(999) }],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
            expect(result[0].amount).toEqual(dec(999))
        })

        it('handles empty holdings', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(5000) }],
                network: 'mainnet',
            })

            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })

        it('isolates holdings by account and network', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(10) }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '200', amount: dec(20) }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: dec(30) }],
                network: 'testnet',
            })

            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR2',
                    network: 'testnet',
                }),
            ).toHaveLength(0)
        })

        it('returns empty array for unknown account', async () => {
            const result = await getAccountHoldings({
                registry,
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
            totalSupply: dec(1),
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
                registry,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: dec(50) },
                    { assetId: '200', amount: dec(0) },
                    { assetId: '300', amount: dec(1) },
                    { assetId: '400', amount: dec(0) },
                    { assetId: '500', amount: dec(0) },
                ],
                network: 'mainnet',
            })
            await upsertAssets({
                registry,
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
                registry,
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
                registry,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(dec(0))
        })

        it('does not overwrite existing holding on conflict', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(500) }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                registry,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(dec(500))
        })

        it('adds alongside existing holdings', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(10) }],
                network: 'mainnet',
            })

            await insertAssetHolding({
                registry,
                accountAddress: 'ADDR1',
                assetId: '200',
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
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
                registry,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: dec(0) },
                    { assetId: '200', amount: dec(0) },
                    { assetId: '300', amount: dec(0) },
                ],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                registry,
                accountAddress: 'ADDR1',
                assetIds: ['100', '200'],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
        })

        it('does not affect other accounts', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(0) }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: dec(0) }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                registry,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })

        it('does not affect other networks', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(0) }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(0) }],
                network: 'testnet',
            })

            await deleteAssetHoldings({
                registry,
                accountAddress: 'ADDR1',
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(0)
            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toHaveLength(1)
        })

        it('handles empty assetIds array', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: dec(0) }],
                network: 'mainnet',
            })

            await deleteAssetHoldings({
                registry,
                accountAddress: 'ADDR1',
                assetIds: [],
                network: 'mainnet',
            })

            expect(
                await getAccountHoldings({
                    registry,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toHaveLength(1)
        })
    })

    describe('balances', () => {
        it('inserts a new balance', async () => {
            await upsertAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: dec(5000000),
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: dec(100000),
                status: 'Online',
                authAddress: null,
            })

            const result = await getAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(dec(5000000))
            expect(result!.totalAssetsOptedIn).toBe(3)
            expect(result!.minBalance).toEqual(dec(100000))
            expect(result!.status).toBe('Online')
        })

        it('updates an existing balance on conflict', async () => {
            await upsertAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: dec(5000000),
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                minBalance: dec(100000),
                status: 'Online',
                authAddress: null,
            })

            await upsertAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: dec(9000000),
                totalAssetsOptedIn: 5,
                totalCreatedAssets: 2,
                totalAppsOptedIn: 3,
                minBalance: dec(200000),
                status: 'Offline',
                authAddress: 'AUTH1',
            })

            const result = await getAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalance).toEqual(dec(9000000))
            expect(result!.totalAssetsOptedIn).toBe(5)
            expect(result!.minBalance).toEqual(dec(200000))
            expect(result!.status).toBe('Offline')
            expect(result!.authAddress).toBe('AUTH1')
        })

        it('returns undefined for unknown account', async () => {
            const result = await getAccountBalance({
                registry,
                accountAddress: 'UNKNOWN',
                network: 'mainnet',
            })

            expect(result).toBeUndefined()
        })

        it('retrieves all balances for multiple addresses', async () => {
            await upsertAccountBalance({
                registry,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalance: dec(1000),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: dec(0),
                status: 'Offline',
                authAddress: null,
            })
            await upsertAccountBalance({
                registry,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                algoBalance: dec(2000),
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                minBalance: dec(0),
                status: 'Offline',
                authAddress: null,
            })

            const result = await getAllAccountBalances({
                registry,
                accountAddresses: ['ADDR1', 'ADDR2'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
        })
    })

    describe('getAllAssetIdsForNetwork', () => {
        it('returns distinct asset IDs across accounts', async () => {
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: dec(10) },
                    { assetId: '200', amount: dec(20) },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                registry,
                accountAddress: 'ADDR2',
                holdings: [
                    { assetId: '200', amount: dec(30) },
                    { assetId: '300', amount: dec(40) },
                ],
                network: 'mainnet',
            })

            const result = await getAllAssetIdsForNetwork({
                registry,
                network: 'mainnet',
            })

            expect(result.sort()).toEqual(['100', '200', '300'])
        })
    })
})
