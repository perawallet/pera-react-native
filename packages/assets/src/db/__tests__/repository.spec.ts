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
import Decimal from 'decimal.js'
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
        totalSupply: Decimal('10000000000'),
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

    describe('asset prices', () => {
        it('inserts and retrieves prices', async () => {
            await upsertAssetPrices({
                db,
                prices: [
                    { assetId: '100', usdPrice: '1.50' },
                    { assetId: '200', usdPrice: '0.75' },
                ],
                network: 'mainnet',
            })

            const result = await getAssetPricesByIds({
                db,
                assetIds: ['100', '200'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(2)
            expect(result.find(r => r.assetId === '100')?.usdPrice).toBe('1.50')
        })

        it('updates existing prices on conflict', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '100', usdPrice: '1.00' }],
                network: 'mainnet',
            })

            await upsertAssetPrices({
                db,
                prices: [{ assetId: '100', usdPrice: '2.00' }],
                network: 'mainnet',
            })

            const result = await getAssetPricesByIds({
                db,
                assetIds: ['100'],
                network: 'mainnet',
            })

            expect(result).toHaveLength(1)
            expect(result[0].usdPrice).toBe('2.00')
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
})
