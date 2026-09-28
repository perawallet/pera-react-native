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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    upsertAssetPrices,
    getAssetPricesByIds,
    recordPriceMisses,
    clearPriceMisses,
} from '../pricesRepository'
import { getStaleOrMissingPriceAssetIds } from '../syncQueries'

describe('asset prices repository', () => {
    let db: Database
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        db = result.db
        teardown = result.teardown
        await runMigrations(db, migrations)
    })

    afterEach(() => {
        vi.useRealTimers()
        teardown()
    })

    describe('asset prices', () => {
        it('inserts and retrieves prices', async () => {
            await upsertAssetPrices({
                db,
                prices: [
                    { assetId: '100', usdPrice: new Decimal('1.50') },
                    { assetId: '200', usdPrice: new Decimal('0.75') },
                ],
                network: 'mainnet',
            })

            const result = await getAssetPricesByIds({
                db,
                assetIds: ['100', '200'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.find(r => r.assetId === '100')?.usdPrice).toEqual(
                new Decimal('1.5'),
            )
        })

        it('updates existing prices on conflict', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '100', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })

            await upsertAssetPrices({
                db,
                prices: [{ assetId: '100', usdPrice: new Decimal('2.00') }],
                network: 'mainnet',
            })

            const result = await getAssetPricesByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].usdPrice).toEqual(new Decimal('2'))
        })

        it('does nothing for empty prices', async () => {
            await upsertAssetPrices({
                db,
                prices: [],
                network: 'mainnet',
            })

            const result = await getAssetPricesByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })
    })

    describe('price misses', () => {
        it('defers ids with a fresh miss row when missRetryMs is given', async () => {
            await recordPriceMisses({
                db,
                assetIds: ['777'],
                network: 'testnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['777', '888'],
                network: 'testnet',
                ttlMs: 60_000,
                missRetryMs: 10 * 60 * 1000,
            })

            expect(result).toEqual(['888'])
        })

        it('does not defer misses when missRetryMs is omitted', async () => {
            await recordPriceMisses({
                db,
                assetIds: ['777'],
                network: 'testnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['777'],
                network: 'testnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual(['777'])
        })

        it('returns ids again once the miss row is older than missRetryMs', async () => {
            await recordPriceMisses({
                db,
                assetIds: ['777'],
                network: 'testnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['777'],
                network: 'testnet',
                ttlMs: 60_000,
                missRetryMs: -1,
            })

            expect(result).toEqual(['777'])
        })

        it('clearPriceMisses makes an id fetchable again immediately', async () => {
            await recordPriceMisses({
                db,
                assetIds: ['777'],
                network: 'testnet',
            })

            await clearPriceMisses({
                db,
                assetIds: ['777'],
                network: 'testnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['777'],
                network: 'testnet',
                ttlMs: 60_000,
                missRetryMs: 10 * 60 * 1000,
            })

            expect(result).toEqual(['777'])
        })

        it('scopes miss rows to their network', async () => {
            await recordPriceMisses({
                db,
                assetIds: ['888'],
                network: 'testnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['888'],
                network: 'mainnet',
                ttlMs: 60_000,
                missRetryMs: 10 * 60 * 1000,
            })

            expect(result).toEqual(['888'])
        })

        it('defers every miss on a large portfolio (no fixed cap)', async () => {
            const manyIds = Array.from({ length: 600 }, (_, i) => `${1000 + i}`)
            await recordPriceMisses({
                db,
                assetIds: manyIds,
                network: 'mainnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: manyIds,
                network: 'mainnet',
                ttlMs: 60_000,
                missRetryMs: 10 * 60 * 1000,
            })

            expect(result).toEqual([])
        })

        it('a fresh price row wins even when a stale-price id also has a fresh miss row', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '555', usdPrice: new Decimal('1.0') }],
                network: 'mainnet',
            })
            await recordPriceMisses({
                db,
                assetIds: ['555'],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['555'],
                network: 'mainnet',
                ttlMs: 60_000,
                missRetryMs: 10 * 60 * 1000,
            })

            expect(result).toEqual([])
        })
    })
})
