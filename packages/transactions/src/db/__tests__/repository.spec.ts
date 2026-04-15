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
import type { TransactionHistoryItem } from '../../models/types'
import {
    upsertTransactions,
    getTransactionHistory,
    getLatestTransactionRoundTime,
} from '../repository'

describe('transaction repository', () => {
    let registry: CollectionRegistry

    beforeEach(() => {
        registry = bootstrapTestCollections()
    })

    afterEach(() => {
        resetRegistryForTest()
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
        ...overrides,
    })

    it('inserts and retrieves transactions', async () => {
        await upsertTransactions({
            registry,
            items: [makeTx()],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
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
            registry,
            items: [makeTx({ amount: new Decimal(100) })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        await upsertTransactions({
            registry,
            items: [makeTx({ amount: new Decimal(200) })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
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
            registry,
            items: [
                makeTx({ id: 'TX_ASSET', asset }),
                makeTx({ id: 'TX_NO_ASSET' }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const withAsset = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            assetId: '31566704',
        })

        const all = await getTransactionHistory({
            registry,
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
            registry,
            items,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            limit: 3,
        })

        expect(result).toHaveLength(3)
    })

    it('orders by roundTime DESC', async () => {
        await upsertTransactions({
            registry,
            items: [
                makeTx({ id: 'TX_OLD', roundTime: 1700000000 }),
                makeTx({ id: 'TX_NEW', roundTime: 1700001000 }),
                makeTx({ id: 'TX_MID', roundTime: 1700000500 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result.map(r => r.id)).toEqual(['TX_NEW', 'TX_MID', 'TX_OLD'])
    })

    it('isolates transactions by network', async () => {
        await upsertTransactions({
            registry,
            items: [makeTx({ id: 'TX_MAIN' })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        await upsertTransactions({
            registry,
            items: [makeTx({ id: 'TX_TEST' })],
            accountAddress: 'ACCT1',
            network: 'testnet',
        })

        const mainnet = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })
        const testnet = await getTransactionHistory({
            registry,
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
            registry,
            items: [makeTx({ asset, swapGroupDetail, interpretedMeaning })],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result[0].asset).toEqual(asset)
        expect(result[0].swapGroupDetail).toEqual(swapGroupDetail)
        expect(result[0].interpretedMeaning).toEqual(interpretedMeaning)
    })

    it('supports beforeRoundTime pagination', async () => {
        await upsertTransactions({
            registry,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 2000 }),
                makeTx({ id: 'TX3', roundTime: 3000 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getTransactionHistory({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
            beforeRoundTime: 2500,
        })

        expect(result.map(r => r.id)).toEqual(['TX2', 'TX1'])
    })

    it('returns the latest round time for an account', async () => {
        await upsertTransactions({
            registry,
            items: [
                makeTx({ id: 'TX1', roundTime: 1000 }),
                makeTx({ id: 'TX2', roundTime: 3000 }),
                makeTx({ id: 'TX3', roundTime: 2000 }),
            ],
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        const result = await getLatestTransactionRoundTime({
            registry,
            accountAddress: 'ACCT1',
            network: 'mainnet',
        })

        expect(result).toBe(3000)
    })

    it('returns null for an account with no transactions', async () => {
        const result = await getLatestTransactionRoundTime({
            registry,
            accountAddress: 'UNKNOWN',
            network: 'mainnet',
        })

        expect(result).toBeNull()
    })
})
