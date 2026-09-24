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
    upsertAssetPrices,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    refreshAccountHoldings,
    insertAssetHolding,
} from '../holdingsRepository'
import {
    getAccountHoldingsPage,
    getAccountCollectiblesLite,
    assetFromHoldingLiteRow,
} from '../holdingsQueries'

describe('account holdings queries', () => {
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
        // `assetId.includes(term)` semantics.
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

    describe('holdings page', () => {
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

    describe('assetFromHoldingLiteRow', () => {
        const unsyncedRow = (assetId: string) => ({
            assetId,
            decimals: null,
            creatorAddress: null,
            totalSupply: null,
            name: null,
            unitName: null,
            url: null,
            metadata: null,
            peraMetadataJson: null,
        })

        it('falls back to the ALGO constant when its seeded row is gone', () => {
            expect(assetFromHoldingLiteRow(unsyncedRow('0'))).toEqual(
                expect.objectContaining({ assetId: '0', decimals: 6 }),
            )
        })

        it('stays null for an ASA whose metadata has not synced', () => {
            expect(assetFromHoldingLiteRow(unsyncedRow('100'))).toBeNull()
        })
    })
})
