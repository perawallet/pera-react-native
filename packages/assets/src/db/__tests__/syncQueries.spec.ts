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
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import type { PeraAsset, PeraAssetType } from '../../models'
import {
    upsertAssets,
    upsertNodeAssets,
    getAssetsByIds,
} from '../metadataRepository'
import { upsertAssetPrices, recordPriceMisses } from '../pricesRepository'
import {
    getCollectibleIdsMissingUrl,
    getStaleOrMissingAssetIds,
    getStaleOrMissingPriceAssetIds,
} from '../syncQueries'

const MAINNET_SCOPE = scopeForLegacyNetwork('mainnet')
const TESTNET_SCOPE = scopeForLegacyNetwork('testnet')

describe('asset sync queries', () => {
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

    describe('getStaleOrMissingAssetIds', () => {
        it('returns empty for empty input', async () => {
            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: [],
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })
            expect(result).toEqual([])
        })

        it('includes IDs that are not in the DB', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1', '2', '3'],
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })

            expect(new Set(result)).toEqual(new Set(['2', '3']))
        })

        it('excludes IDs whose row is younger than ttlMs', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })

        it('includes IDs whose row is older than ttlMs', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                scope: MAINNET_SCOPE,
            })

            // Use a negative ttl so any row is "older than" it — works without
            // touching the row's stored timestamp.
            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
                ttlMs: -1,
            })

            expect(result).toEqual(['1'])
        })

        it('ignores rows belonging to a different network', async () => {
            await upsertAssets({
                db,
                items: [makeAsset({ assetId: '1' })],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                scope: TESTNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })
            const candidates = Array.from(
                { length: 40_000 },
                (_, i) => `${i + 1}`,
            )

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: candidates,
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
                ...recheck(-1),
            })

            expect(new Set(result)).toEqual(new Set(['1', '2']))
        })

        it('waits out the recheck TTL between rechecks', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
                ...recheck(60_000),
            })

            expect(result).toEqual([])
        })

        it('stops rechecking once the asset is no longer newly seen', async () => {
            await seed([{ assetId: '1', type: 'standard_asset' }])

            const result = await getStaleOrMissingAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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

                // Stops before 0009, which rebuilds the asset caches.
                await runMigrations(
                    upgrading.db,
                    Object.fromEntries(
                        Object.entries(migrations).filter(
                            ([tag]) => Number(tag.slice(0, 4)) < 9,
                        ),
                    ),
                )

                const result = await getStaleOrMissingAssetIds({
                    db: upgrading.db,
                    assetIds: ['1'],
                    scope: MAINNET_SCOPE,
                    ...recheck(-1),
                })

                expect(result).toEqual([])
                expect(
                    await getAssetsByIds({
                        db: upgrading.db,
                        assetIds: ['1'],
                        scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            const rows = await getAssetsByIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual(['1'])
        })

        it('only considers the candidate ids', async () => {
            await seedTyped('1', null, 'collectible')
            await seedTyped('2', null, 'collectible')

            const result = await getCollectibleIdsMissingUrl({
                db,
                assetIds: ['2'],
                scope: MAINNET_SCOPE,
            })

            expect(result).toEqual(['2'])
        })

        it('caps the batch via limit', async () => {
            await seedTyped('1', null, 'collectible')
            await seedTyped('2', null, 'collectible')

            const result = await getCollectibleIdsMissingUrl({
                db,
                assetIds: ['1', '2'],
                scope: MAINNET_SCOPE,
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
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })
            expect(result).toEqual([])
        })

        it('includes IDs without a price row', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1', '2'],
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })

            expect(result).toEqual(['2'])
        })

        it('excludes IDs whose price row is younger than ttlMs', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
            })

            expect(result).toEqual([])
        })

        it('includes IDs whose price row is older than ttlMs', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                scope: MAINNET_SCOPE,
            })

            // Negative ttl makes any row "older than" it — see the
            // getStaleOrMissingAssetIds twin above.
            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                scope: MAINNET_SCOPE,
                ttlMs: -1,
            })

            expect(result).toEqual(['1'])
        })

        it('ignores price rows belonging to a different network', async () => {
            await upsertAssetPrices({
                db,
                prices: [{ assetId: '1', usdPrice: new Decimal('1.00') }],
                scope: MAINNET_SCOPE,
            })

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: ['1'],
                scope: TESTNET_SCOPE,
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
                scope: MAINNET_SCOPE,
            })
            await recordPriceMisses({
                db,
                assetIds: ['2'],
                scope: MAINNET_SCOPE,
            })
            const candidates = Array.from(
                { length: 40_000 },
                (_, i) => `${i + 1}`,
            )

            const result = await getStaleOrMissingPriceAssetIds({
                db,
                assetIds: candidates,
                scope: MAINNET_SCOPE,
                ttlMs: 60_000,
                missRetryMs: 60_000,
            })

            expect(result).toHaveLength(39_998)
            expect(result).not.toContain('1')
            expect(result).not.toContain('2')
        })
    })
})
