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
    refreshAccountHoldings,
    getAccountHoldings,
    insertAssetHolding,
    deleteAssetHoldings,
    upsertAccountBalance,
    getAccountBalance,
    getAllAccountBalances,
    getAllAssetIdsForNetwork,
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
})
