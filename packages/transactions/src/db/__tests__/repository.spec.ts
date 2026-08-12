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
import type { TransactionHistoryItem } from '../../models/types'
import {
    upsertTransactions,
    getTransactionHistory,
    getLatestTransactionRoundTime,
} from '../repository'

describe('transaction repository', () => {
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

    const makeTx = (
        overrides: Partial<TransactionHistoryItem> = {},
    ): TransactionHistoryItem => ({
        id: 'TX001',
        txType: 'pay',
        sender: 'SENDER_ADDR',
        receiver: 'RECEIVER_ADDR',
        confirmedRound: 12345,
        roundTime: 1700000000,
        fee: new Decimal(1000),
        groupId: null,
        amount: new Decimal(5000000),
        closeTo: null,
        applicationId: null,
        innerTransactionCount: null,
        asset: null,
        swapGroupDetail: null,
        interpretedMeaning: null,
        balanceImpacts: [],
        ...overrides,
    })

    it('inserts and retrieves transactions', async () => {
        await upsertTransactions({
            db,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result).toHaveLength(1)
        expect(result[0].id).toBe('TX001')
        expect(result[0].sender).toBe('SENDER_ADDR')
        expect(result[0].amount).toEqual(new Decimal(5000000))
    })

    it('upserts duplicate transaction IDs without duplicating', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(100) })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        await upsertTransactions({
            db,
            items: [makeTx({ amount: new Decimal(200) })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result).toHaveLength(1)
        expect(result[0].amount).toEqual(new Decimal(200))
    })

    it('filters by assetId', async () => {
        const asset = {
            assetId: 31566704,
            name: 'USDC',
            unitName: 'USDC',
            decimals: 6,
        }

        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX_ASSET', asset }),
                makeTx({ id: 'TX_NO_ASSET' }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const withAsset = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            assetId: '31566704',
        })

        const all = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(withAsset).toHaveLength(1)
        expect(withAsset[0].id).toBe('TX_ASSET')
        expect(all).toHaveLength(2)
    })

    it('respects limit parameter', async () => {
        const items = Array.from({ length: 10 }, (_, i) =>
            makeTx({ id: `TX${i}`, roundTime: 1700000000 + i }),
        )

        await upsertTransactions({
            db,
            items,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            limit: 3,
        })

        expect(result).toHaveLength(3)
    })

    it('orders by roundTime DESC', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX_OLD', roundTime: 1700000000 }),
                makeTx({ id: 'TX_NEW', roundTime: 1700001000 }),
                makeTx({ id: 'TX_MID', roundTime: 1700000500 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result.map(r => r.id)).toEqual(['TX_NEW', 'TX_MID', 'TX_OLD'])
    })

    it('isolates transactions by network', async () => {
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TX_MAIN' })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        await upsertTransactions({
            db,
            items: [makeTx({ id: 'TX_TEST' })],
            accountAddress: 'ACCT1',
            network: 'testnet',
        })

        const mainnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        const testnet = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'testnet',
        })

        expect(mainnet).toHaveLength(1)
        expect(mainnet[0].id).toBe('TX_MAIN')
        expect(testnet).toHaveLength(1)
        expect(testnet[0].id).toBe('TX_TEST')
    })

    it('round-trips nested objects correctly', async () => {
        const asset = {
            assetId: 100,
            name: 'Test',
            unitName: 'TST',
            decimals: 2,
        }
        const swapGroupDetail = {
            assetInId: 0,
            assetInUnitName: 'ALGO',
            assetOutId: 100,
            assetOutUnitName: 'TST',
            amountIn: '1000',
            amountOut: '500',
        }
        const interpretedMeaning = {
            title: 'Swap ALGO for TST',
            description: 'Swapped 1000 ALGO for 500 TST',
        }

        await upsertTransactions({
            db,
            items: [makeTx({ asset, swapGroupDetail, interpretedMeaning })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result[0].asset).toEqual(asset)
        expect(result[0].swapGroupDetail).toEqual(swapGroupDetail)
        expect(result[0].interpretedMeaning).toEqual(interpretedMeaning)
    })

    it('round-trips balance impacts, preserving signed Decimal amounts', async () => {
        const balanceImpacts = [
            {
                assetId: '0',
                unitName: 'ALGO',
                fractionDecimals: 6,
                amount: new Decimal('-1500000'),
            },
            {
                assetId: '31566704',
                unitName: 'USDC',
                fractionDecimals: 6,
                amount: new Decimal('2000000'),
            },
        ]

        await upsertTransactions({
            db,
            items: [makeTx({ txType: 'appl', balanceImpacts })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result[0].balanceImpacts).toEqual(balanceImpacts)
    })

    it('defaults balance impacts to an empty array for legacy rows', async () => {
        await upsertTransactions({
            db,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result[0].balanceImpacts).toEqual([])
    })

    it('supports atOrBeforeRoundTime pagination', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 2000 }),
                makeTx({ id: 'TX3', roundTime: 3000 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            atOrBeforeRoundTime: 2500,
        })

        expect(result.map(r => r.id)).toEqual(['TX2', 'TX1'])
    })

    // The cursor is inclusive so an atomic group straddling a page edge isn't
    // silently dropped; the caller filters the ids it already holds.
    it('includes transactions exactly at the cursor round time', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 2000 }),
                makeTx({ id: 'TX3', roundTime: 2000 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            atOrBeforeRoundTime: 2000,
        })

        expect(result.map(r => r.id).sort()).toEqual(['TX1', 'TX2', 'TX3'])
    })

    describe('date range filtering', () => {
        // UTC start-of-day round times for consecutive days.
        const JAN_01 = 1704067200 // 2024-01-01T00:00:00Z
        const JAN_02 = 1704153600 // 2024-01-02T00:00:00Z
        const JAN_03 = 1704240000 // 2024-01-03T00:00:00Z

        beforeEach(async () => {
            await upsertTransactions({
                db,
                items: [
                    makeTx({ id: 'TX_JAN01', roundTime: JAN_01 + 100 }),
                    makeTx({ id: 'TX_JAN02', roundTime: JAN_02 + 100 }),
                    makeTx({ id: 'TX_JAN03', roundTime: JAN_03 + 100 }),
                ],
                accountAddress: 'ACCT1',
                network: 'mainnet',
            })
        })

        it('filters to transactions on/after afterTime', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                network: 'mainnet',
                afterTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN03', 'TX_JAN02'])
        })

        it('filters to transactions on/before beforeTime (day-inclusive)', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                network: 'mainnet',
                beforeTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN02', 'TX_JAN01'])
        })

        it('filters to a single day when afterTime and beforeTime match', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                network: 'mainnet',
                afterTime: '2024-01-02',
                beforeTime: '2024-01-02',
            })

            expect(result.map(r => r.id)).toEqual(['TX_JAN02'])
        })

        it('ignores unparseable date strings', async () => {
            const result = await getTransactionHistory({
                db,
                accountAddress: 'ACCT1',
                network: 'mainnet',
                afterTime: 'not-a-date',
            })

            expect(result).toHaveLength(3)
        })
    })

    it('returns the latest round time for an account', async () => {
        await upsertTransactions({
            db,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 3000 }),
                makeTx({ id: 'TX3', roundTime: 2000 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getLatestTransactionRoundTime({
            db,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result).toBe(3000)
    })

    it('returns null for an account with no transactions', async () => {
        const result = await getLatestTransactionRoundTime({
            db,
            accountAddress: 'UNKNOWN',
            network: 'mainnet',
        })

        expect(result).toBeNull()
    })
})
