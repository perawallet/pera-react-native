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
import type { PeraAsset } from '../../models'
import {
    upsertAssets,
    getAssetsByIds,
    upsertAssetPrices,
    getAssetPricesByIds,
    updateAssetPeraMetadata,
    getStaleOrMissingAssetIds,
    getStaleOrMissingPriceAssetIds,
    deleteAssets,
    deleteAssetPrices,
    recordPriceMisses,
    clearPriceMisses,
} from '../repository'

describe('asset repository', () => {
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

    const makeAsset = (overrides: Partial<PeraAsset> = {}): PeraAsset => ({
        assetId: '31566704',
        decimals: 6,
        creator: { address: 'ABC123' },
        totalSupply: new Decimal('10000000000'),
        name: 'USD Coin',
        unitName: 'USDC',
        url: 'https://usdc.example.com',
        peraMetadata: {
            isDeleted: false,
            verificationTier: 'verified',
            isFavorited: true,
        },
        ...overrides,
    })

    describe('assets', () => {
        it('inserts and retrieves assets', async () => {
            await upsertAssets({
                db,
                items: [makeAsset()],
                network: 'mainnet',
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].assetId).toBe('31566704')
            expect(result[0].name).toBe('USD Coin')
            expect(result[0].decimals).toBe(6)
            expect(result[0].totalSupply.toString()).toBe('10000000000')
            expect(result[0].creator.address).toBe('ABC123')
        })

        it('updates existing assets on conflict', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ name: 'Old Name' })],
                network: 'mainnet',
            })
            await upsertAssets({
                db,
                items: [makeAsset({ name: 'New Name' })],
                network: 'mainnet',
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe('New Name')
        })

        it('returns empty array for unknown IDs', async () => {
            const result = await getAssetsByIds({
                db,
                assetIds: ['999999'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })

        it('returns empty array for empty input', async () => {
            const result = await getAssetsByIds({
                db,
                assetIds: [],
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })

        it('isolates assets by network', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '100' })],
                network: 'mainnet',
            })
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '100', name: 'Testnet Asset' })],
                network: 'testnet',
            })

            const mainnet = await getAssetsByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })
            const testnet = await getAssetsByIds({
                db,
                assetIds: ['100'],
                network: 'testnet',
            })

            expect(mainnet).toHaveLength(1)
            expect(mainnet[0].name).toBe('USD Coin')
            expect(testnet).toHaveLength(1)
            expect(testnet[0].name).toBe('Testnet Asset')
        })

        it('round-trips PeraAssetMetadata correctly', async () => {
            const asset = makeAsset({
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    isFavorited: true,
                    isPriceAlertEnabled: false,
                    logo: 'https://logo.png',
                },
            })

            await upsertAssets({ db, items: [asset], network: 'mainnet' })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result[0].peraMetadata?.isFavorited).toBe(true)
            expect(result[0].peraMetadata?.logo).toBe('https://logo.png')
        })

        it('handles multiple assets in a single batch', async () => {
            const items = [
                makeAsset({ assetId: '1', name: 'Asset 1' }),
                makeAsset({ assetId: '2', name: 'Asset 2' }),
                makeAsset({ assetId: '3', name: 'Asset 3' }),
            ]

            await upsertAssets({ db, items, network: 'mainnet' })

            const result = await getAssetsByIds({
                db,
                assetIds: ['1', '2', '3'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(3)
        })

        it('does nothing for empty items', async () => {
            await upsertAssets({ db, items: [], network: 'mainnet' })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })
    })

    describe('updateAssetPeraMetadata', () => {
        it('updates specific metadata fields without overwriting others', async () => {
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: false,
                            isPriceAlertEnabled: false,
                            logo: 'https://logo.png',
                        },
                    }),
                ],
                network: 'mainnet',
            })

            await updateAssetPeraMetadata({
                db,
                assetId: '31566704',
                network: 'mainnet',
                updates: { isFavorited: true },
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result[0].peraMetadata?.isFavorited).toBe(true)
            expect(result[0].peraMetadata?.isPriceAlertEnabled).toBe(false)
            expect(result[0].peraMetadata?.logo).toBe('https://logo.png')
        })

        it('updates isPriceAlertEnabled without overwriting isFavorited', async () => {
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: true,
                            isPriceAlertEnabled: false,
                        },
                    }),
                ],
                network: 'mainnet',
            })

            await updateAssetPeraMetadata({
                db,
                assetId: '31566704',
                network: 'mainnet',
                updates: { isPriceAlertEnabled: true },
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            expect(result[0].peraMetadata?.isFavorited).toBe(true)
            expect(result[0].peraMetadata?.isPriceAlertEnabled).toBe(true)
        })

        it('does nothing when asset does not exist', async () => {
            await updateAssetPeraMetadata({
                db,
                assetId: '999999',
                network: 'mainnet',
                updates: { isFavorited: true },
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['999999'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(0)
        })
    })

    describe('sync merges device-specific fields by null-ness', () => {
        it('preserves isFavorited and isPriceAlertEnabled when the sync response omits them (null)', async () => {
            // Initial sync stores asset with defaults
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: false,
                            isPriceAlertEnabled: false,
                        },
                    }),
                ],
                network: 'mainnet',
            })

            // User toggles favorite and price alert
            await updateAssetPeraMetadata({
                db,
                assetId: '31566704',
                network: 'mainnet',
                updates: { isFavorited: true, isPriceAlertEnabled: true },
            })

            // A non-device-scoped (V1) sync response carries no favorite /
            // price-alert state, so those fields arrive as null/undefined.
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: undefined,
                            isPriceAlertEnabled: undefined,
                        },
                    }),
                ],
                network: 'mainnet',
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            // Null incoming values keep the existing local state
            expect(result[0].peraMetadata?.isFavorited).toBe(true)
            expect(result[0].peraMetadata?.isPriceAlertEnabled).toBe(true)
        })

        it('overwrites isFavorited and isPriceAlertEnabled when the sync response includes them (non-null)', async () => {
            // A prior toggle set the device-specific flags locally
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: false,
                            isPriceAlertEnabled: false,
                        },
                    }),
                ],
                network: 'mainnet',
            })
            await updateAssetPeraMetadata({
                db,
                assetId: '31566704',
                network: 'mainnet',
                updates: { isFavorited: true, isPriceAlertEnabled: true },
            })

            // A device-scoped (V2) response carries this device's real state:
            // no longer favorited / alerting. Non-null values overwrite.
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'verified',
                            isFavorited: false,
                            isPriceAlertEnabled: false,
                        },
                    }),
                ],
                network: 'mainnet',
            })

            const result = await getAssetsByIds({
                db,
                assetIds: ['31566704'],
                network: 'mainnet',
            })

            // Non-null incoming values win over the stale local toggle values
            expect(result[0].peraMetadata?.isFavorited).toBe(false)
            expect(result[0].peraMetadata?.isPriceAlertEnabled).toBe(false)
        })
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

    describe('getStaleOrMissingAssetIds', () => {
        it('returns empty for empty input', async () => {
            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: [],
                network: 'mainnet',
                ttlMs: 60_000,
            })
            expect(result).toEqual([])
        })

        it('includes IDs that are not in the DB', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2', '3'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(new Set(result)).toEqual(new Set(['2', '3']))
        })

        it('excludes IDs whose row is younger than ttlMs', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })

        it('includes IDs whose row is older than ttlMs', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                network: 'mainnet',
            })

            // Use a negative ttl so any row is "older than" it — works without
            // touching the row's stored timestamp.
            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: -1,
            })

            expect(result).toEqual(['1'])
        })

        it('ignores rows belonging to a different network', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'testnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual(['1'])
        })
    })

    describe('getStaleOrMissingPriceAssetIds', () => {
        it('returns empty for empty input', async () => {
            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: [],
                network: 'mainnet',
                ttlMs: 60_000,
            })
            expect(result).toEqual([])
        })

        it('includes IDs without a price row', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1', '2'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual(['2'])
        })

        it('excludes IDs whose price row is younger than ttlMs', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })

        it('includes IDs whose price row is older than ttlMs', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })

            // Negative ttl makes any row "older than" it — see the
            // getStaleOrMissingAssetIds twin above.
            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: -1,
            })

            expect(result).toEqual(['1'])
        })

        it('ignores price rows belonging to a different network', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                network: 'testnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual(['1'])
        })
    })

    describe('deleteAssets / deleteAssetPrices', () => {
        it('deletes node + pera rows for the given ids on the given network', async () => {
            await upsertAssets({
                db,
                items: [
                    makeAsset({ assetId: '100' }),
                    makeAsset({ assetId: '200' }),
                ],
                network: 'mainnet',
            })

            await deleteAssets({ db, assetIds: ['100'], network: 'mainnet' })

            const remaining = await getAssetsByIds({
                db,
                assetIds: ['100', '200'],
                network: 'mainnet',
            })
            expect(remaining.map(a => a.assetId)).toEqual(['200'])
        })

        it('does not touch assets on a different network', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '100' })],
                network: 'mainnet',
            })
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '100' })],
                network: 'testnet',
            })

            await deleteAssets({ db, assetIds: ['100'], network: 'mainnet' })

            const mainnet = await getAssetsByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })
            const testnet = await getAssetsByIds({
                db,
                assetIds: ['100'],
                network: 'testnet',
            })
            expect(mainnet).toHaveLength(0)
            expect(testnet).toHaveLength(1)
        })

        it('is a no-op for an empty id list', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '100' })],
                network: 'mainnet',
            })

            await deleteAssets({ db, assetIds: [], network: 'mainnet' })

            const remaining = await getAssetsByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })
            expect(remaining).toHaveLength(1)
        })

        it('deletes prices for the given ids on the given network', async () => {
            await upsertAssetPrices({
                db,
                prices: [
                    { assetId: '100', usdPrice: new Decimal('1.5') },
                    { assetId: '200', usdPrice: new Decimal('2.5') },
                ],
                network: 'mainnet',
            })

            await deleteAssetPrices({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })

            const remaining = await getAssetPricesByIds({
                db,
                assetIds: ['100', '200'],
                network: 'mainnet',
            })
            expect(remaining.map(p => p.assetId)).toEqual(['200'])
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
