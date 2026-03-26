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
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertAccountHoldings,
    getAccountHoldings,
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
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: '5000' },
                    { assetId: '200', amount: '300' },
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
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: '5000' },
                    { assetId: '200', amount: '300' },
                ],
                network: 'mainnet',
            })

            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: '999' }],
                network: 'mainnet',
            })

            const result = await getAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('300')
            expect(result[0].amount).toBe('999')
        })

        it('handles empty holdings', async () => {
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: '5000' }],
                network: 'mainnet',
            })

            await upsertAccountHoldings({
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
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '100', amount: '10' }],
                network: 'mainnet',
            })
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [{ assetId: '200', amount: '20' }],
                network: 'mainnet',
            })
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [{ assetId: '300', amount: '30' }],
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

    describe('balances', () => {
        it('inserts a new balance', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalanceMicro: '5000000',
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                authAddress: null,
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalanceMicro).toBe('5000000')
            expect(result!.totalAssetsOptedIn).toBe(3)
        })

        it('updates an existing balance on conflict', async () => {
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalanceMicro: '5000000',
                totalAssetsOptedIn: 3,
                totalCreatedAssets: 1,
                totalAppsOptedIn: 2,
                authAddress: null,
            })

            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
                algoBalanceMicro: '9000000',
                totalAssetsOptedIn: 5,
                totalCreatedAssets: 2,
                totalAppsOptedIn: 3,
                authAddress: 'AUTH1',
            })

            const result = await getAccountBalance({
                db,
                accountAddress: 'ADDR1',
                network: 'mainnet',
            })

            expect(result).toBeDefined()
            expect(result!.algoBalanceMicro).toBe('9000000')
            expect(result!.totalAssetsOptedIn).toBe(5)
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
                algoBalanceMicro: '1000',
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
                authAddress: null,
            })
            await upsertAccountBalance({
                db,
                accountAddress: 'ADDR2',
                network: 'mainnet',
                algoBalanceMicro: '2000',
                totalAssetsOptedIn: 0,
                totalCreatedAssets: 0,
                totalAppsOptedIn: 0,
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
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                holdings: [
                    { assetId: '100', amount: '10' },
                    { assetId: '200', amount: '20' },
                ],
                network: 'mainnet',
            })
            await upsertAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                holdings: [
                    { assetId: '200', amount: '30' },
                    { assetId: '300', amount: '40' },
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
