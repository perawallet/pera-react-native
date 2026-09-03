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
import { sql } from 'drizzle-orm'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import type { PeraAsset, PeraAssetType } from '../../models'
import {
    upsertAssets,
    upsertNodeAssets,
    getAssetsByIds,
    getCollectibleIdsMissingUrl,
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
        vi.useRealTimers()
        teardown()
    })

    const readTimestamps = async (
        assetId: string,
    ): Promise<{ firstSeenAt: number | null; updatedAt: number }> => {
        const rows = (await db.all(
            sql`select first_seen_at, updated_at from assets_pera where asset_id = ${assetId}`,
        )) as Array<[number | null, number]>
        return { firstSeenAt: rows[0]![0], updatedAt: rows[0]![1] }
    }

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

        it('keeps first_seen_at at the first sighting across refetches', async () => {
            // The unclassified-recheck window is measured from this column, so
            // a refetch bumping it would keep an asset "newly seen" forever.
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
            await upsertAssets({ db, items: [makeAsset()], network: 'mainnet' })
            const first = await readTimestamps('31566704')

            vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
            await upsertAssets({ db, items: [makeAsset()], network: 'mainnet' })
            const second = await readTimestamps('31566704')

            expect(second.firstSeenAt).toBe(first.firstSeenAt)
            expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
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

        it('filters candidate lists beyond SQLite bound-parameter limits', async () => {
            // A 10k-asset wallet feeds every held id into this gate; a
            // parameter-per-id query dies at SQLITE_MAX_VARIABLE_NUMBER and
            // costs seconds of JS in query build below it.
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                network: 'mainnet',
            })
            const candidates = Array.from(
                { length: 40_000 },
                (_, i) => `${i + 1}`,
            )

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: candidates,
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toHaveLength(39_999)
            expect(result).not.toContain('1')
        })
    })

    describe('getStaleOrMissingAssetIds — unclassified recheck', () => {
        // The backend types an asset as a collectible only after its crawler
        // has fetched the asset's media, which lands seconds to hours after
        // the mint. These params are what stop that first "not a collectible"
        // answer from being cached for the full ttlMs.
        const recheck = (ttlMs: number, windowMs = 60_000) => ({
            ttlMs: 60_000,
            recheckUnclassified: { ttlMs, windowMs },
        })

        // Pure-NFT shape, since only NFT-shaped assets are worth re-asking
        // about. makeAsset's default is a fungible token.
        const seed = async (
            items: Array<{ assetId: string; type?: string }>,
            overrides: Partial<PeraAsset> = {
                decimals: 0,
                totalSupply: new Decimal(1),
            },
        ): Promise<void> => {
            await upsertAssets({
                db,
                items: items.map(({ assetId, type }) =>
                    makeAsset({
                        assetId,
                        ...overrides,
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'unverified',
                            ...(type
                                ? { type: type as PeraAssetType }
                                : undefined),
                        },
                    }),
                ),
                network: 'mainnet',
            })
        }

        it('rechecks newly seen assets the backend has not typed as a collectible', async () => {
            await seed([
                { assetId: '1', type: 'standard_asset' },
                { assetId: '2' },
                { assetId: '3', type: 'collectible' },
            ])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2', '3'],
                network: 'mainnet',
                ...recheck(-1),
            })

            expect(new Set(result)).toEqual(new Set(['1', '2']))
        })

        it('leaves fungible tokens alone however recently they were seen', async () => {
            // Without this filter a wallet of ~600 plain tokens re-asks about
            // every one of them for the whole window, on every sync tick and
            // account view.
            await seed(
                [{ assetId: '1', type: 'standard_asset' }, { assetId: '2' }],
                { decimals: 6, totalSupply: new Decimal('10000000000') },
            )

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2'],
                network: 'mainnet',
                ...recheck(-1),
            })

            expect(result).toEqual([])
        })

        it('rechecks editioned and fractional NFTs, not just one-of-ones', async () => {
            // Editions (indivisible, many copies) are a quarter of the NFTs in
            // a real wallet; fractional ARC-3 NFTs hold 10^decimals units.
            await seed([{ assetId: '1', type: 'standard_asset' }], {
                decimals: 0,
                totalSupply: new Decimal(1000),
            })
            await seed([{ assetId: '2', type: 'standard_asset' }], {
                decimals: 2,
                totalSupply: new Decimal(100),
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2'],
                network: 'mainnet',
                ...recheck(-1),
            })

            expect(new Set(result)).toEqual(new Set(['1', '2']))
        })

        it('waits out the recheck TTL between rechecks', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ...recheck(60_000),
            })

            expect(result).toEqual([])
        })

        it('stops rechecking once the asset is no longer newly seen', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                // Negative window: the row's first sight is already outside it.
                ...recheck(-1, -1),
            })

            expect(result).toEqual([])
        })

        it('leaves rows cached before the column existed on the long TTL', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])
            await db.run(sql`update assets_pera set first_seen_at = null`)

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ...recheck(-1),
            })

            expect(result).toEqual([])
        })

        it('leaves an install that upgraded into the column on the long TTL', async () => {
            // The real upgrade path: a DB migrated to just before first_seen_at,
            // holding an asset the backend never typed as a collectible. Its
            // rows must survive the migration and stay on the long TTL rather
            // than every pre-existing asset re-fetching at once.
            const upgrading = createTestDatabase()
            try {
                await runMigrations(
                    upgrading.db,
                    Object.fromEntries(
                        Object.entries(migrations).filter(
                            ([tag]) => Number(tag.slice(0, 4)) < 5,
                        ),
                    ),
                )
                const cachedAt = Date.now()
                await upgrading.db.run(
                    // NFT-shaped, so a NULL first_seen_at is the only thing
                    // keeping it off the recheck list.
                    sql`insert into assets_node (asset_id, network, decimals, total_supply, updated_at) values ('1', 'mainnet', 0, '1', ${cachedAt})`,
                )
                await upgrading.db.run(
                    sql`insert into assets_pera (asset_id, network, asset_type, updated_at) values ('1', 'mainnet', 'standard_asset', ${cachedAt})`,
                )

                await runMigrations(upgrading.db, migrations)

                const result = await getStaleOrMissingAssetIds({
                    db: upgrading.db,
                    assetIds: ['1'],
                    network: 'mainnet',
                    ...recheck(-1),
                })

                expect(result).toEqual([])
                expect(
                    await getAssetsByIds({
                        db: upgrading.db,
                        assetIds: ['1'],
                        network: 'mainnet',
                    }),
                ).toHaveLength(1)
            } finally {
                upgrading.teardown()
            }
        })

        it('does not recheck when the caller omits the recheck params', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })
    })

    describe('getStaleOrMissingAssetIds — ARC19 recheck', () => {
        // ARC19 media is mutable: the manager's acfg re-points the reserve
        // address at a new CID and the backend re-crawls, but only a re-fetch
        // of the assets_pera row picks the new media URL up.
        const ARC19_URL =
            'template-ipfs://{ipfscid:1:raw:reserve:sha2-256}#arc3'

        const seedNft = async (
            assetId: string,
            url?: string,
            type: PeraAssetType = 'collectible',
        ): Promise<void> => {
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        assetId,
                        url,
                        decimals: 0,
                        totalSupply: new Decimal(1),
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'unverified',
                            type,
                        },
                    }),
                ],
                network: 'mainnet',
            })
        }

        const agePeraRow = () =>
            db.run(sql`update assets_pera set updated_at = 0`)

        it('rechecks a stale ARC19 collectible even while its node half is fresh', async () => {
            // The collectible detail screen persists through upsertNodeAssets,
            // bumping assets_node.updated_at without refreshing the pera-half
            // media — the main gate reads that timestamp, so a viewed NFT can
            // dodge it forever. The carve-out must key on the pera half.
            await seedNft('1', ARC19_URL)
            await agePeraRow()

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
                recheckArc19: { ttlMs: 60_000 },
            })

            expect(result).toEqual(['1'])
        })

        it('waits out the ARC19 recheck TTL between rechecks', async () => {
            await seedNft('1', ARC19_URL)

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
                recheckArc19: { ttlMs: 60_000 },
            })

            expect(result).toEqual([])
        })

        it('leaves collectibles with immutable urls alone', async () => {
            await seedNft('1', 'ipfs://QmSomeFixedCid')
            await seedNft('2', 'https://example.com/nft.json')
            await agePeraRow()

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2'],
                network: 'mainnet',
                ttlMs: 60_000,
                recheckArc19: { ttlMs: 60_000 },
            })

            expect(result).toEqual([])
        })

        it('leaves template-ipfs assets the backend has not typed as collectibles to the unclassified recheck', async () => {
            await seedNft('1', ARC19_URL, 'standard_asset')
            await agePeraRow()

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
                recheckArc19: { ttlMs: 60_000 },
            })

            expect(result).toEqual([])
        })

        it('does not recheck when the caller omits the param', async () => {
            await seedNft('1', ARC19_URL)
            await agePeraRow()

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })

        it('preserves a learned url when a bulk write omits it', async () => {
            // The bulk /v2/assets/ serializer carries no url at all, so every
            // bulk refetch would null out the url the backfill learned from
            // the indexer — and with it the ARC19 recheck.
            await seedNft('1', ARC19_URL)
            await seedNft('1', undefined)

            const rows = await getAssetsByIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
            })

            expect(rows[0].url).toBe(ARC19_URL)
        })

        it('preserves a learned url across a node-half write that omits it', async () => {
            await seedNft('1', ARC19_URL)
            await upsertNodeAssets({
                db,
                items: [
                    makeAsset({
                        assetId: '1',
                        url: undefined,
                        decimals: 0,
                        totalSupply: new Decimal(1),
                    }),
                ],
                network: 'mainnet',
            })

            const rows = await getAssetsByIds({
                db,
                assetIds: ['1'],
                network: 'mainnet',
            })

            expect(rows[0].url).toBe(ARC19_URL)
        })
    })

    describe('getCollectibleIdsMissingUrl', () => {
        // The bulk asset endpoint has no url field, so collectibles synced
        // through it need a one-time indexer lookup before the ARC19 recheck
        // can recognize them. NULL means "never asked"; '' means "asked, the
        // chain has no url" and must not be re-asked.
        const seedTyped = async (
            assetId: string,
            url: string | null,
            type: PeraAssetType,
        ): Promise<void> => {
            await upsertAssets({
                db,
                items: [
                    makeAsset({
                        assetId,
                        url: url ?? undefined,
                        decimals: 0,
                        totalSupply: new Decimal(1),
                        peraMetadata: {
                            isDeleted: false,
                            verificationTier: 'unverified',
                            type,
                        },
                    }),
                ],
                network: 'mainnet',
            })
        }

        it('returns collectibles whose url was never resolved', async () => {
            await seedTyped('1', null, 'collectible')
            await seedTyped('2', 'template-ipfs://x', 'collectible')
            await seedTyped('3', '', 'collectible')
            await seedTyped('4', null, 'standard_asset')

            const result = await getCollectibleIdsMissingUrl({
                db,
                assetIds: ['1', '2', '3', '4'],
                network: 'mainnet',
            })

            expect(result).toEqual(['1'])
        })

        it('only considers the candidate ids', async () => {
            await seedTyped('1', null, 'collectible')
            await seedTyped('2', null, 'collectible')

            const result = await getCollectibleIdsMissingUrl({
                db,
                assetIds: ['2'],
                network: 'mainnet',
            })

            expect(result).toEqual(['2'])
        })

        it('caps the batch via limit', async () => {
            await seedTyped('1', null, 'collectible')
            await seedTyped('2', null, 'collectible')

            const result = await getCollectibleIdsMissingUrl({
                db,
                assetIds: ['1', '2'],
                network: 'mainnet',
                limit: 1,
            })

            expect(result).toHaveLength(1)
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

        it('applies the fresh and miss filters to candidate lists beyond SQLite bound-parameter limits', async () => {
            // Same constraint as the assets-gate twin above: the
            // whole held set flows through here every price pass.
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                network: 'mainnet',
            })
            await recordPriceMisses({
                db,
                assetIds: ['2'],
                network: 'mainnet',
            })
            const candidates = Array.from(
                { length: 40_000 },
                (_, i) => `${i + 1}`,
            )

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: candidates,
                network: 'mainnet',
                ttlMs: 60_000,
                missRetryMs: 60_000,
            })

            expect(result).toHaveLength(39_998)
            expect(result).not.toContain('1')
            expect(result).not.toContain('2')
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
