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
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    refreshAccountHoldings,
    getAccountHoldings,
    getAccountPortfolioTotals,
    getAccountHoldingsPage,
    getAccountHoldingsLite,
    getAccountCollectiblesLite,
    insertAssetHolding,
    addToAssetHolding,
    deleteAssetHoldings,
    upsertAccountBalance,
    getAccountBalance,
    getAllAccountBalances,
    getAllHeldAssetIdsForNetwork,
    getAssetHolderAddresses,
    getHeldAssetIdsByAccount,
    deleteAllAssetHoldingsForAccount,
    deleteAccountBalance,
} from '../repository'
import { upsertAssetPrices } from '@perawallet/wallet-core-assets'

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

        it('persists the frozen flag and reports an isFrozen-only change', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n, isFrozen: true }],
                network: 'mainnet',
            })

            const page = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(page[0].isFrozen).toBe(true)

            // Unfreeze with the same amount — must still be detected as a change.
            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5000n, isFrozen: false }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const after = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(after[0].isFrozen).toBe(false)
        })

        it('carries the frozen flag on the lite rows the asset list renders', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5000n, isFrozen: true },
                    { assetId: '200', amount: 7000n, isFrozen: false },
                ],
                network: 'mainnet',
            })

            const rows = await getAccountHoldingsLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            const byId = new Map(rows.map(r => [r.assetId, r.isFrozen]))
            expect(byId.get('100')).toBe(true)
            expect(byId.get('200')).toBe(false)
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

    describe('refreshAccountHoldings diff semantics', () => {
        it('returns true when holdings are first written', async () => {
            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)
        })

        it('returns false when nothing changed', async () => {
            const holdings = [
                { assetId: '100', amount: new Decimal(10) },
                { assetId: '200', amount: new Decimal(20) },
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })
            expect(changed).toBe(false)
        })

        it('returns true and updates only the changed amount', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(20) },
                ],
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(999) },
                ],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            const byId = new Map(result.map(r => [r.assetId, r.amount]))
            expect(byId.get('100')).toEqual(new Decimal(10))
            expect(byId.get('200')).toEqual(new Decimal(999))
        })

        it('returns true and removes holdings dropped from the incoming set', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: new Decimal(10) },
                    { assetId: '200', amount: new Decimal(20) },
                ],
                network: 'mainnet',
            })

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: new Decimal(10) }],
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(result.map(r => r.assetId)).toEqual(['100'])
        })

        it('writes a large holding set across multiple batches', async () => {
            const holdings = Array.from({ length: 450 }, (_, i) => ({
                assetId: `${i + 1}`,
                amount: new Decimal(i + 1),
            }))

            const changed = await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings,
                network: 'mainnet',
            })
            expect(changed).toBe(true)

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            expect(result).toHaveLength(450)
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

    describe('addToAssetHolding', () => {
        it('inserts a new holding carrying the credited amount', async () => {
            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('100')
            expect(result[0].amount).toEqual(new Decimal(250))
        })

        it('adds to the existing amount when the holding exists', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 500n }],
                network: 'mainnet',
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(250),
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].amount).toEqual(new Decimal(750))
        })

        it('leaves other accounts and assets untouched', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 10n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 20n }],
                network: 'mainnet',
            })

            await addToAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '100',
                network: 'mainnet',
                amount: new Decimal(5),
            })

            const addr1 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })
            const addr2 = await getAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
            })

            expect(addr1[0].amount).toEqual(new Decimal(15))
            expect(addr2[0].amount).toEqual(new Decimal(20))
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

    describe('per-account cleanup helpers', () => {
        const balanceArgs = (accountAddress: string, network: string) => ({
            db,
            accountAddress,
            network,
            algoBalance: new Decimal('1'),
            totalAssetsOptedIn: 0,
            totalCreatedAssets: 0,
            totalAppsOptedIn: 0,
            minBalance: new Decimal('0.1'),
            status: 'Offline',
            authAddress: null,
        })

        it('getHeldAssetIdsByAccount returns the account holdings across networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: 5n },
                    { assetId: '200', amount: 0n },
                ],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                network: 'testnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '999', amount: 1n }],
                network: 'mainnet',
            })

            const held = await getHeldAssetIdsByAccount({
                db,
                accountAddress: 'ADDR1',
            })

            expect(
                [...held].sort((a, b) =>
                    `${a.network}:${a.assetId}`.localeCompare(
                        `${b.network}:${b.assetId}`,
                    ),
                ),
            ).toEqual([
                { assetId: '100', network: 'mainnet' },
                { assetId: '200', network: 'mainnet' },
                { assetId: '300', network: 'testnet' },
            ])
        })

        it('deleteAllAssetHoldingsForAccount removes only that account holdings on all networks', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: 5n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: 7n }],
                network: 'testnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '100', amount: 9n }],
                network: 'mainnet',
            })

            await deleteAllAssetHoldingsForAccount({
                db,
                accountAddress: 'ADDR1',
            })

            expect(
                await getHeldAssetIdsByAccount({ db, accountAddress: 'ADDR1' }),
            ).toEqual([])
            const addr2 = await getHeldAssetIdsByAccount({
                db,
                accountAddress: 'ADDR2',
            })
            expect(addr2).toEqual([{ assetId: '100', network: 'mainnet' }])
        })

        it('deleteAccountBalance removes the account balance row(s)', async () => {
            await upsertAccountBalance(balanceArgs('ADDR1', 'mainnet'))
            await upsertAccountBalance(balanceArgs('ADDR1', 'testnet'))
            await upsertAccountBalance(balanceArgs('ADDR2', 'mainnet'))

            await deleteAccountBalance({ db, accountAddress: 'ADDR1' })

            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'mainnet',
                }),
            ).toBeUndefined()
            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR1',
                    network: 'testnet',
                }),
            ).toBeUndefined()
            expect(
                await getAccountBalance({
                    db,
                    accountAddress: 'ADDR2',
                    network: 'mainnet',
                }),
            ).toBeDefined()
        })
    })

    describe('getAllHeldAssetIdsForNetwork', () => {
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

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                network: 'mainnet',
            })

            expect(result.sort()).toEqual(['100', '200', '300'])
        })

        it('returns ids in a stable ascending order', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '300', amount: 1n },
                    { assetId: '100', amount: 1n },
                    { assetId: '200', amount: 1n },
                ],
                network: 'mainnet',
            })

            const result = await getAllHeldAssetIdsForNetwork({
                db,
                network: 'mainnet',
            })

            expect(result).toEqual(['100', '200', '300'])
        })
    })

    describe('getAssetHolderAddresses', () => {
        it('returns owners before opted-in-only accounts, scoped to the network', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OPTED_IN',
                holdings: [{ assetId: '500', amount: 0n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OWNER',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_OTHER_NETWORK',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'testnet',
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual(['ADDR_OWNER', 'ADDR_OPTED_IN'])
        })

        it('orders same-status holders by address so repeated lookups agree', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_B',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR_A',
                holdings: [{ assetId: '500', amount: 1n }],
                network: 'mainnet',
            })

            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual(['ADDR_A', 'ADDR_B'])
        })

        it('returns an empty list for an asset no account holds', async () => {
            const result = await getAssetHolderAddresses({
                db,
                assetId: '500',
                network: 'mainnet',
            })

            expect(result).toEqual([])
        })
    })

    describe('getAccountCollectiblesLite', () => {
        const collectible = (
            assetId: string,
            title: string,
            collectionName?: string,
        ): PeraAsset => ({
            assetId,
            decimals: 0,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1),
            name: `Asset ${title}`,
            unitName: 'NFT',
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'unverified',
                type: PeraAssetType.collectible,
                collectible: {
                    title,
                    collection: collectionName
                        ? { name: collectionName }
                        : undefined,
                },
            },
        })

        const token = (assetId: string, name: string): PeraAsset => ({
            assetId,
            decimals: 6,
            creator: { address: 'CREATOR' },
            totalSupply: new Decimal(1_000_000),
            name,
            unitName: 'TOK',
            peraMetadata: {
                isDeleted: false,
                verificationTier: 'verified',
                type: PeraAssetType.standard_asset,
            },
        })

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '2', amount: new Decimal(1) },
                    { assetId: '10', amount: new Decimal(1) },
                    { assetId: '30', amount: new Decimal(0) },
                    { assetId: '400', amount: new Decimal(5_000_000) },
                ],
            })
            await upsertAssets({
                db,
                network: 'mainnet',
                items: [
                    collectible('2', 'Banana', 'Fruit Club'),
                    collectible('10', 'apple', 'Fruit Club'),
                    collectible('30', 'Cherry', 'Stone Co'),
                    token('400', 'USDC'),
                ],
            })
        })

        it('carries the frozen flag the gallery badges rows with', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                holdings: [
                    { assetId: '2', amount: new Decimal(1), isFrozen: true },
                    { assetId: '10', amount: new Decimal(1) },
                ],
            })

            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            const byId = new Map(rows.map(r => [r.assetId, r.isFrozen]))
            expect(byId.get('2')).toBe(true)
            expect(byId.get('10')).toBe(false)
        })

        it('returns only collectibles, never fungible holdings', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(rows.map(r => r.assetId).sort()).toEqual(['10', '2', '30'])
        })

        it('excludes zero-balance collectibles when opted-in are hidden', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                includeOptedInOnly: false,
            })

            expect(rows.map(r => r.assetId).sort()).toEqual(['10', '2'])
        })

        it('surfaces title and collection name without parsing in JS', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'titleAsc',
            })

            expect(rows[0].title).toBe('apple')
            expect(rows[0].collectionName).toBe('Fruit Club')
        })

        it('sorts by title case-insensitively', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'titleAsc',
            })

            expect(rows.map(r => r.title)).toEqual([
                'apple',
                'Banana',
                'Cherry',
            ])
        })

        it('reverses title order for titleDesc', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'titleDesc',
            })

            expect(rows.map(r => r.title)).toEqual([
                'Cherry',
                'Banana',
                'apple',
            ])
        })

        // Asset ids are TEXT columns, so a naive ORDER BY would put '10'
        // before '2'.
        it('orders newest-first numerically, not lexicographically', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'newestFirst',
            })

            expect(rows.map(r => r.assetId)).toEqual(['30', '10', '2'])
        })

        // SQLite integers are signed 64-bit, so `CAST(id AS INTEGER)` saturates
        // silently past 2^63-1: every id above it compares equal and sorts
        // arbitrarily. Asset ids are uint64, so the ordering must not cast.
        it('orders ids beyond the signed-64-bit range correctly', async () => {
            const huge = [
                '9223372036854775807', // 2^63-1
                '9223372036854775808', // 2^63
                '18446744073709551615', // 2^64-1
            ]
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                holdings: huge.map(assetId => ({
                    assetId,
                    amount: new Decimal(1),
                })),
            })
            await upsertAssets({
                db,
                network: 'mainnet',
                items: huge.map((assetId, i) =>
                    collectible(assetId, `Huge ${i}`),
                ),
            })

            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                sortMode: 'oldestFirst',
            })

            expect(rows.map(r => r.assetId)).toEqual(huge)
        })

        it('orders oldest-first numerically', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'oldestFirst',
            })

            expect(rows.map(r => r.assetId)).toEqual(['2', '10', '30'])
        })

        it('searches title, collection name and asset name', async () => {
            const byTitle = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                search: 'cherry',
            })
            const byCollection = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                search: 'Stone',
            })
            const byName = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                search: 'Asset Banana',
            })

            expect(byTitle.map(r => r.assetId)).toEqual(['30'])
            expect(byCollection.map(r => r.assetId)).toEqual(['30'])
            expect(byName.map(r => r.assetId)).toEqual(['2'])
        })

        // Substring, not exact: mirrors the global search's
        // `assetId.includes(term)` semantics (PERA-4900).
        it('searches by asset id', async () => {
            const byFullId = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                search: '30',
            })
            const byPartialId = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                search: '1',
            })

            expect(byFullId.map(r => r.assetId)).toEqual(['30'])
            expect(byPartialId.map(r => r.assetId)).toEqual(['10'])
        })

        it('omits collectibles whose node metadata has not synced', async () => {
            await insertAssetHolding({
                db,
                accountAddress: 'ADDR1',
                assetId: '999',
                network: 'mainnet',
                amount: '1',
            })

            const rows = await getAccountCollectiblesLite({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(rows.map(r => r.assetId)).not.toContain('999')
        })
    })

    describe('portfolio totals + holdings page', () => {
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

        const pageIds = async (
            params: Partial<Parameters<typeof getAccountHoldingsPage>[0]> = {},
        ) => {
            const rows = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                limit: 100,
                offset: 0,
                ...params,
            })
            return rows.map(r => r.assetId)
        }

        it('orders favorites first, then by value descending', async () => {
            // '300' favorited → first; then 200(3) > 100(2) > algo(1).
            expect(await pageIds({ sortMode: 'balanceDesc' })).toEqual([
                '300',
                '200',
                '100',
                '0',
            ])
        })

        it('orders by value ascending (favorites still first)', async () => {
            expect(await pageIds({ sortMode: 'balanceAsc' })).toEqual([
                '300',
                '0',
                '100',
                '200',
            ])
        })

        it('sorts a priced holding without metadata with the unsynced rows, not by an inflated value', async () => {
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

            // Base units × price would put '999' first; without decimals its
            // value is unknowable, so it belongs in the NULLs-last bucket.
            expect(await pageIds({ sortMode: 'balanceDesc' })).toEqual([
                '300',
                '200',
                '100',
                '0',
                '999',
            ])
        })

        it('orders alphabetically with favorites first', async () => {
            // Favorited 'Zebra'(300) first; then Algo, Apple, Banana.
            expect(await pageIds({ sortMode: 'alphabeticalAsc' })).toEqual([
                '300',
                '0',
                '200',
                '100',
            ])
        })

        it('paginates with limit/offset preserving order', async () => {
            expect(
                await pageIds({ sortMode: 'balanceDesc', limit: 2, offset: 0 }),
            ).toEqual(['300', '200'])
            expect(
                await pageIds({ sortMode: 'balanceDesc', limit: 2, offset: 2 }),
            ).toEqual(['100', '0'])
        })

        it('filters out zero balances', async () => {
            expect(
                await pageIds({
                    sortMode: 'balanceDesc',
                    hideZeroBalance: true,
                }),
            ).toEqual(['200', '100', '0'])
        })

        it('searches by name (case-insensitive substring)', async () => {
            expect(await pageIds({ search: 'app' })).toEqual(['200'])
        })

        it('enriches rows with asset metadata and price', async () => {
            const rows = await getAccountHoldingsPage({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                sortMode: 'balanceDesc',
                limit: 100,
                offset: 0,
            })
            const apple = rows.find(r => r.assetId === '200')
            expect(apple?.asset?.name).toBe('Apple')
            expect(apple?.usdPrice?.toString()).toBe('3')
            const zebra = rows.find(r => r.assetId === '300')
            expect(zebra?.isFavorited).toBe(true)
        })
    })
})
