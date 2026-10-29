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
    FAKE_NATIVE_ASSET,
    fakeAssetsAdapter,
} from '@perawallet/wallet-core-assets/testing'
import {
    assetsChainAdapters,
    upsertAssets,
    upsertAssetPrices,
    nativeAssetFor,
    PeraAssetType,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    refreshAccountHoldings,
    insertAssetHolding,
} from '../holdingsRepository'
import {
    getAccountHoldingsPage,
    getAccountHoldingsLite,
    getAccountHeldAssets,
    getAccountCollectiblesLite,
    assetFromHoldingLiteRow,
} from '../holdingsQueries'
import { LEGACY_CHAIN_ID } from '@perawallet/wallet-core-chain-contract'

const MAINNET_SCOPE = {
    chainId: LEGACY_CHAIN_ID,
    networkId: 'mainnet',
} as const

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

    describe('keepZeroNative', () => {
        const idsOf = async (filters: {
            hideZeroBalance?: boolean
            keepZeroNative?: boolean
        }) =>
            (
                await getAccountHoldingsLite({
                    db,
                    sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                    ...filters,
                })
            )
                .map(row => row.assetId)
                .sort()

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [
                    {
                        assetId: nativeAssetFor(LEGACY_CHAIN_ID).assetId,
                        amount: new Decimal(0),
                    },
                    { assetId: '10', amount: new Decimal(0) },
                    { assetId: '20', amount: new Decimal(5) },
                ],
            })
        })

        it('keeps the zero native holding while hiding other zero balances', async () => {
            expect(
                await idsOf({ hideZeroBalance: true, keepZeroNative: true }),
            ).toEqual(['0', '20'])
        })

        it('hides it with the plain hide-zero filter', async () => {
            expect(await idsOf({ hideZeroBalance: true })).toEqual(['20'])
        })

        it('changes nothing without the hide-zero filter', async () => {
            expect(await idsOf({ keepZeroNative: true })).toEqual([
                '0',
                '10',
                '20',
            ])
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
                scope: MAINNET_SCOPE,
                holdings: [
                    { assetId: '2', amount: new Decimal(1) },
                    { assetId: '10', amount: new Decimal(1) },
                    { assetId: '30', amount: new Decimal(0) },
                    { assetId: '400', amount: new Decimal(5_000_000) },
                ],
            })
            await upsertAssets({
                db,
                scope: MAINNET_SCOPE,
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
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
            })

            expect(rows.map(r => r.assetId).sort()).toEqual(['10', '2', '30'])
        })

        it('excludes zero-balance collectibles when they are hidden', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                includeZeroBalance: false,
            })

            expect(rows.map(r => r.assetId).sort()).toEqual(['10', '2'])
        })

        it('surfaces title and collection name without parsing in JS', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                sortMode: 'titleAsc',
            })

            expect(rows[0].title).toBe('apple')
            expect(rows[0].collectionName).toBe('Fruit Club')
        })

        it('sorts by title case-insensitively', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
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
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
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
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
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
                scope: MAINNET_SCOPE,
                holdings: huge.map(assetId => ({
                    assetId,
                    amount: new Decimal(1),
                })),
            })
            await upsertAssets({
                db,
                scope: MAINNET_SCOPE,
                items: huge.map((assetId, i) =>
                    collectible(assetId, `Huge ${i}`),
                ),
            })

            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR2', scope: MAINNET_SCOPE }],
                sortMode: 'oldestFirst',
            })

            expect(rows.map(r => r.assetId)).toEqual(huge)
        })

        it('orders oldest-first numerically', async () => {
            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                sortMode: 'oldestFirst',
            })

            expect(rows.map(r => r.assetId)).toEqual(['2', '10', '30'])
        })

        it('searches title, collection name and asset name', async () => {
            const byTitle = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                search: 'cherry',
            })
            const byCollection = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                search: 'Stone',
            })
            const byName = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
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
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
                search: '30',
            })
            const byPartialId = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
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
                scope: MAINNET_SCOPE,
                amount: new Decimal(1),
            })

            const rows = await getAccountCollectiblesLite({
                db,
                sources: [{ address: 'ADDR1', scope: MAINNET_SCOPE }],
            })

            expect(rows.map(r => r.assetId)).not.toContain('999')
        })

        it('reads every source in one pass and tags each row with its scope', async () => {
            const testnet = {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'testnet',
            } as const
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                scope: testnet,
                holdings: [{ assetId: '10', amount: new Decimal(1) }],
            })
            await upsertAssets({
                db,
                scope: testnet,
                items: [collectible('10', 'apple', 'Fruit Club')],
            })

            const rows = await getAccountCollectiblesLite({
                db,
                sources: [
                    { address: 'ADDR1', scope: MAINNET_SCOPE },
                    { address: 'ADDR2', scope: testnet },
                ],
            })

            expect(
                rows.map(r => `${r.scope.networkId}:${r.assetId}`).sort(),
            ).toEqual(['mainnet:10', 'mainnet:2', 'mainnet:30', 'testnet:10'])
        })

        it('reads nothing for no sources', async () => {
            expect(
                await getAccountCollectiblesLite({ db, sources: [] }),
            ).toEqual([])
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
                scope: MAINNET_SCOPE,
                holdings: [
                    { assetId: '0', amount: new Decimal(5_000_000) },
                    { assetId: '100', amount: new Decimal(2_000_000) },
                    { assetId: '200', amount: new Decimal(1_000_000) },
                    { assetId: '300', amount: new Decimal(0) },
                ],
            })
            await upsertAssets({
                db,
                scope: MAINNET_SCOPE,
                items: [
                    richAsset('0', 'Algo'),
                    richAsset('100', 'Banana'),
                    richAsset('200', 'Apple'),
                    richAsset('300', 'Zebra', { favorited: true }),
                ],
            })
            await upsertAssetPrices({
                db,
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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

        it('searches by asset id', async () => {
            expect(await pageIds({ search: '30' })).toEqual(['300'])
        })

        it('still finds ALGO by its full id', async () => {
            expect(await pageIds({ search: '0' })).toContain('0')
        })

        describe('across sources', () => {
            const ETH_SCOPE = {
                chainId: 'ethereum',
                networkId: 'mainnet',
            } as const
            const TESTNET_SCOPE = {
                chainId: LEGACY_CHAIN_ID,
                networkId: 'testnet',
            } as const
            const ETH_SOURCE = { address: '0xETH', scope: ETH_SCOPE }
            const ALGO_SOURCE = { address: 'ADDR1', scope: MAINNET_SCOPE }

            beforeEach(async () => {
                // Ether '0xE' worth 2.5, token '0xT' worth 0.5: they interleave
                // with the Algorand rows (3, 2, 1) by USD value.
                await refreshAccountHoldings({
                    db,
                    accountAddress: '0xETH',
                    scope: ETH_SCOPE,
                    holdings: [
                        { assetId: '0xE', amount: new Decimal(2_500_000) },
                        { assetId: '0xT', amount: new Decimal(500_000) },
                    ],
                })
                await upsertAssets({
                    db,
                    scope: ETH_SCOPE,
                    items: [
                        richAsset('0xE', 'Ether'),
                        richAsset('0xT', 'Token'),
                    ],
                })
                await upsertAssetPrices({
                    db,
                    scope: ETH_SCOPE,
                    prices: [
                        { assetId: '0xE', usdPrice: new Decimal('1') },
                        { assetId: '0xT', usdPrice: new Decimal('1') },
                    ],
                })
                await refreshAccountHoldings({
                    db,
                    accountAddress: 'ADDR1',
                    scope: TESTNET_SCOPE,
                    holdings: [{ assetId: '0', amount: new Decimal(1) }],
                })
            })

            it('orders rows from every source by one USD value and tags each with its scope', async () => {
                const rows = await getAccountHoldingsLite({
                    db,
                    sources: [ALGO_SOURCE, ETH_SOURCE],
                    sortMode: 'balanceDesc',
                })

                expect(rows.map(r => [r.scope.chainId, r.assetId])).toEqual([
                    ['algorand', '300'],
                    ['algorand', '200'],
                    ['ethereum', '0xE'],
                    ['algorand', '100'],
                    ['algorand', '0'],
                    ['ethereum', '0xT'],
                ])
            })

            it('reads only the sources it is given', async () => {
                const rows = await getAccountHoldingsLite({
                    db,
                    sources: [ETH_SOURCE],
                })

                expect(rows.map(r => r.assetId)).toEqual(['0xE', '0xT'])
                expect(rows.every(r => r.scope.chainId === 'ethereum')).toBe(
                    true,
                )
            })

            it('keeps another network of the same chain out', async () => {
                const rows = await getAccountHoldingsLite({
                    db,
                    sources: [ALGO_SOURCE],
                })

                expect(rows.every(r => r.scope.networkId === 'mainnet')).toBe(
                    true,
                )
            })

            it('searches across sources', async () => {
                const rows = await getAccountHoldingsLite({
                    db,
                    sources: [ALGO_SOURCE, ETH_SOURCE],
                    search: 'tok',
                })

                expect(rows.map(r => r.assetId)).toEqual(['0xT'])
            })

            it("reads each row's cross-chain group id without its metadata", async () => {
                await upsertAssets({
                    db,
                    scope: ETH_SCOPE,
                    items: [
                        {
                            ...richAsset('0xT', 'Token'),
                            peraMetadata: {
                                isDeleted: false,
                                verificationTier: 'verified',
                                crossChainAssetGroup: {
                                    id: 'usdc',
                                    name: 'USD Coin',
                                    symbol: 'USDC',
                                },
                            },
                        },
                    ],
                })

                const rows = await getAccountHoldingsLite({
                    db,
                    sources: [ETH_SOURCE],
                })

                expect(
                    rows.map(r => [r.assetId, r.crossChainAssetGroupId]),
                ).toEqual([
                    ['0xE', null],
                    ['0xT', 'usdc'],
                ])
            })

            it('returns nothing for no sources', async () => {
                expect(
                    await getAccountHoldingsLite({ db, sources: [] }),
                ).toEqual([])
            })
        })
    })

    describe('native asset search', () => {
        const ETH_MAINNET = {
            chainId: 'ethereum',
            networkId: 'mainnet',
        } as const
        const ETH_SEPOLIA = {
            chainId: 'ethereum',
            networkId: 'sepolia',
        } as const
        const BASE_MAINNET = { chainId: 'base', networkId: 'mainnet' } as const
        const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
        const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
        const ETHER: PeraAsset = {
            ...FAKE_NATIVE_ASSET,
            assetId: 'native',
            name: 'Ether',
            unitName: 'ETH',
            decimals: 18,
        }
        const mainnetSource = { address: '0xETH', scope: ETH_MAINNET }
        const sepoliaSource = { address: '0xETH', scope: ETH_SEPOLIA }

        const token = (assetId: string, name: string, unitName: string) =>
            ({
                ...FAKE_NATIVE_ASSET,
                assetId,
                name,
                unitName,
                decimals: 6,
            }) satisfies PeraAsset

        const search = async (
            term: string,
            params: Partial<Parameters<typeof getAccountHoldingsLite>[0]> = {},
        ) =>
            (
                await getAccountHoldingsLite({
                    db,
                    sources: [mainnetSource, sepoliaSource],
                    search: term,
                    ...params,
                })
            )
                .map(row => `${row.scope.networkId}:${row.assetId}`)
                .sort()

        beforeEach(async () => {
            assetsChainAdapters.register(
                fakeAssetsAdapter({
                    chainId: 'ethereum',
                    getNativeAsset: () => ETHER,
                }),
            )
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: ETH_MAINNET,
                holdings: [
                    { assetId: 'native', amount: new Decimal(1) },
                    { assetId: WETH, amount: new Decimal(1) },
                    { assetId: USDC, amount: new Decimal(1) },
                ],
            })
            await upsertAssets({
                db,
                scope: ETH_MAINNET,
                items: [
                    token(WETH, 'Wrapped Ether', 'WETH'),
                    token(USDC, 'USD Coin', 'USDC'),
                ],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: ETH_SEPOLIA,
                holdings: [{ assetId: 'native', amount: new Decimal(1) }],
            })
        })

        it.each(['eth', 'ETH', 'Ether'])(
            'finds the native coin, which has no metadata row, by %s',
            async term => {
                expect(
                    await search(term, { sources: [mainnetSource] }),
                ).toContain('mainnet:native')
            },
        )

        it('returns the native coin and the token whose name contains the term', async () => {
            expect(await search('eth', { sources: [mainnetSource] })).toEqual([
                `mainnet:${WETH}`,
                'mainnet:native',
            ])
        })

        it('finds a token by name, symbol and a lower-case address', async () => {
            const sources = [mainnetSource]
            const expected = [`mainnet:${USDC}`]

            expect(await search('usd coin', { sources })).toEqual(expected)
            expect(await search('USDC', { sources })).toEqual(expected)
            expect(await search('0xa0b869', { sources })).toEqual(expected)
            expect(await search(USDC.toLowerCase(), { sources })).toEqual(
                expected,
            )
        })

        it('returns nothing for a term that matches no asset', async () => {
            expect(await search('xyz')).toEqual([])
        })

        it.each(['nat', 'ati', 'tive'])(
            'does not match the native coin by a fragment of its id (%s)',
            async term => {
                expect(await search(term)).toEqual([])
            },
        )

        it('keeps another network of the same chain out of the results', async () => {
            expect(
                await search('eth', { sources: [mainnetSource] }),
            ).not.toContain('sepolia:native')
        })

        it('finds the native coin on each network when both are searched', async () => {
            expect(await search('eth')).toEqual(
                expect.arrayContaining(['mainnet:native', 'sepolia:native']),
            )
        })

        it('still hides a zero-balance native coin that matches the term', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: ETH_SEPOLIA,
                holdings: [{ assetId: 'native', amount: new Decimal(0) }],
            })

            expect(
                await search('eth', {
                    sources: [sepoliaSource],
                    hideZeroBalance: true,
                }),
            ).toEqual([])
        })

        it('pairs the scope with the native id, so another chain sharing that id is not matched', async () => {
            assetsChainAdapters.register(
                fakeAssetsAdapter({
                    chainId: 'base',
                    getNativeAsset: () => ({
                        ...ETHER,
                        name: 'Other Coin',
                        unitName: 'OTH',
                    }),
                }),
            )
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: BASE_MAINNET,
                holdings: [{ assetId: 'native', amount: new Decimal(1) }],
            })

            expect(
                await search('eth', {
                    sources: [
                        mainnetSource,
                        { address: '0xETH', scope: BASE_MAINNET },
                    ],
                }),
            ).toEqual([`mainnet:${WETH}`, 'mainnet:native'])
        })

        it('adds no match, and does not throw, for a chain without an assets adapter', async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: BASE_MAINNET,
                holdings: [{ assetId: 'native', amount: new Decimal(1) }],
            })

            expect(
                await search('eth', {
                    sources: [{ address: '0xETH', scope: BASE_MAINNET }],
                }),
            ).toEqual([])
        })
    })

    describe('getAccountHeldAssets', () => {
        const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
        const TESTNET_SCOPE = {
            chainId: LEGACY_CHAIN_ID,
            networkId: 'testnet',
        } as const

        beforeEach(async () => {
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: MAINNET_SCOPE,
                holdings: [
                    { assetId: '0', amount: new Decimal(5) },
                    { assetId: '100', amount: new Decimal(0) },
                ],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: '0xETH',
                scope: ETH_SCOPE,
                holdings: [{ assetId: '0xE', amount: new Decimal(1) }],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR1',
                scope: TESTNET_SCOPE,
                holdings: [{ assetId: '200', amount: new Decimal(1) }],
            })
            await refreshAccountHoldings({
                db,
                accountAddress: 'ADDR2',
                scope: MAINNET_SCOPE,
                holdings: [{ assetId: '300', amount: new Decimal(1) }],
            })
        })

        it("returns each source's held asset ids with their scope, zero balances included", async () => {
            const held = await getAccountHeldAssets({
                db,
                sources: [
                    { address: 'ADDR1', scope: MAINNET_SCOPE },
                    { address: '0xETH', scope: ETH_SCOPE },
                ],
            })

            expect(
                held
                    .map(
                        ({ scope, assetId }) =>
                            `${scope.chainId}/${scope.networkId}/${assetId}`,
                    )
                    .sort(),
            ).toEqual([
                'algorand/mainnet/0',
                'algorand/mainnet/100',
                'ethereum/mainnet/0xE',
            ])
        })

        it('returns nothing for no sources', async () => {
            expect(await getAccountHeldAssets({ db, sources: [] })).toEqual([])
        })
    })

    describe('assetFromHoldingLiteRow', () => {
        const unsyncedRow = (assetId: string) => ({
            assetId,
            decimals: null,
            chainData: null,
            totalSupply: null,
            name: null,
            unitName: null,
            url: null,
            metadata: null,
            peraMetadataJson: null,
        })

        it('falls back to the adapter native asset when its seeded row is gone', () => {
            expect(assetFromHoldingLiteRow(unsyncedRow('0'), 'algorand')).toBe(
                nativeAssetFor('algorand'),
            )
        })

        it('stays null for an ASA whose metadata has not synced', () => {
            expect(
                assetFromHoldingLiteRow(unsyncedRow('100'), 'algorand'),
            ).toBeNull()
        })
    })
})
