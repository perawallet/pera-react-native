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

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ALGORAND_CHAIN_ID } from '../../../chain-id'

const fetchAssetsMock = vi.hoisted(() => vi.fn())
const fetchCrossChainAssetGroupsMock = vi.hoisted(() =>
    vi.fn(
        async (ids: string[]) =>
            new Map<string, unknown>(ids.map(id => [id, null])),
    ),
)
const transformAssetResponseMock = vi.hoisted(() => vi.fn(a => a))
const fetchAssetItemsMock = vi.hoisted(() => vi.fn())
const transformAssetItemResponseMock = vi.hoisted(() =>
    vi.fn((assetId: string) => ({ assetId }) as unknown),
)
const isV4AssetSyncEnabledMock = vi.hoisted(() => vi.fn(() => false))
const fetchIndexerAssetDetailsMock = vi.hoisted(() => vi.fn())
const transformIndexerAssetResponseMock = vi.hoisted(() => vi.fn(a => a))
const upsertAssetsMock = vi.hoisted(() => vi.fn())
const upsertNodeAssetsMock = vi.hoisted(() => vi.fn())
const upsertPeraAssetsMock = vi.hoisted(() => vi.fn())
const getStaleOrMissingAssetIdsMock = vi.hoisted(() =>
    vi.fn(async ({ assetIds }: { assetIds: string[] }) => assetIds),
)
const getCollectibleIdsMissingUrlMock = vi.hoisted(() =>
    vi.fn(async () => [] as string[]),
)

vi.mock('../../api', () => ({
    fetchAssets: fetchAssetsMock,
    fetchCrossChainAssetGroups: fetchCrossChainAssetGroupsMock,
    transformAssetResponse: transformAssetResponseMock,
    fetchAssetItems: fetchAssetItemsMock,
    transformAssetItemResponse: transformAssetItemResponseMock,
    fetchIndexerAssetDetails: fetchIndexerAssetDetailsMock,
    transformIndexerAssetResponse: transformIndexerAssetResponseMock,
}))

// Spread the real module: the adapter under test loads the native asset, which
// reads PeraAssetType at import.
vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    upsertAssets: upsertAssetsMock,
    upsertNodeAssets: upsertNodeAssetsMock,
    upsertPeraAssets: upsertPeraAssetsMock,
    getStaleOrMissingAssetIds: getStaleOrMissingAssetIdsMock,
    getCollectibleIdsMissingUrl: getCollectibleIdsMissingUrlMock,
}))

vi.mock('../v4-asset-sync-gate', () => ({
    isV4AssetSyncEnabled: isV4AssetSyncEnabledMock,
}))

const canCallIntegrityGuardedRouteMock = vi.hoisted(() => vi.fn(() => true))

vi.mock('@perawallet/wallet-core-app-integrity', () => ({
    canCallIntegrityGuardedRoute: canCallIntegrityGuardedRouteMock,
}))

const deviceIdGetMock = vi.hoisted(() => vi.fn(() => null as string | null))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: { getState: () => ({}) },
    deviceIdForDeployment: () => deviceIdGetMock(),
}))

import {
    ARC19_COLLECTIBLE_RECHECK_TTL_MS,
    ASSET_CACHE_TTL_MS,
    ASSET_NEWLY_SEEN_WINDOW_MS,
    ASSET_RECLASSIFY_TTL_MS,
} from '../../constants'
import { algorandAssetsAdapter } from '../../adapter'
import { hasAlgorandNftShape } from '../../collectible'
import { fetchAndPersistAssets } from '../asset-syncer'

const MAINNET_SCOPE = {
    chainId: ALGORAND_CHAIN_ID,
    networkId: 'mainnet',
} as const
const ref = (assetId: string) => ({ chainId: 'algorand', assetId }) as const

describe('fetchAndPersistAssets', () => {
    beforeEach(() => {
        fetchAssetsMock.mockReset()
        fetchCrossChainAssetGroupsMock.mockClear()
        upsertAssetsMock.mockReset()
        upsertNodeAssetsMock.mockReset()
        upsertPeraAssetsMock.mockReset()
        transformAssetResponseMock.mockClear()
        fetchIndexerAssetDetailsMock.mockReset()
        transformIndexerAssetResponseMock.mockClear()
        getStaleOrMissingAssetIdsMock.mockReset()
        getStaleOrMissingAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) => assetIds,
        )
        getCollectibleIdsMissingUrlMock.mockReset()
        getCollectibleIdsMissingUrlMock.mockResolvedValue([])
        deviceIdGetMock.mockReset()
        deviceIdGetMock.mockReturnValue(null)
        canCallIntegrityGuardedRouteMock.mockReturnValue(true)
        isV4AssetSyncEnabledMock.mockReturnValue(false)
        fetchAssetItemsMock.mockReset()
        transformAssetItemResponseMock.mockClear()
    })

    test('a production build reads Django and the group, never the full v4 item', async () => {
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

        expect(fetchAssetsMock).toHaveBeenCalledTimes(1)
        expect(fetchCrossChainAssetGroupsMock).toHaveBeenCalledTimes(1)
        expect(fetchAssetItemsMock).not.toHaveBeenCalled()
    })

    test('device-scoped: passes the network device id to fetchAssets', async () => {
        deviceIdGetMock.mockReturnValue('555')
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

        expect(fetchAssetsMock).toHaveBeenCalledWith(
            ['1', '2'],
            'mainnet',
            '555',
        )
    })

    test('no device id: fetches without device scoping', async () => {
        deviceIdGetMock.mockReturnValue(null)
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

        expect(fetchAssetsMock).toHaveBeenCalledWith(
            ['1', '2'],
            'mainnet',
            null,
        )
    })

    describe('cross-chain groups', () => {
        const USDC_GROUP = { id: 'usdc', name: 'USD Coin', symbol: 'USDC' }
        const STORED = { isDeleted: false, verificationTier: 'verified' }

        beforeEach(() => {
            fetchAssetsMock.mockResolvedValue({
                results: [{ asset_id: 1 }, { asset_id: 2 }],
            })
            transformAssetResponseMock.mockImplementation(
                (item: { asset_id: number }) => ({
                    assetId: `${item.asset_id}`,
                    peraMetadata: STORED,
                }),
            )
        })

        afterEach(() => {
            transformAssetResponseMock.mockImplementation(a => a)
        })

        const persisted = () =>
            upsertAssetsMock.mock.lastCall?.[0].items.map(
                (item: { peraMetadata: { crossChainAssetGroup?: unknown } }) =>
                    item.peraMetadata.crossChainAssetGroup,
            )

        test("stores each asset's group from the v4 read, null for one in none", async () => {
            fetchCrossChainAssetGroupsMock.mockResolvedValueOnce(
                new Map<string, unknown>([
                    ['1', USDC_GROUP],
                    ['2', null],
                ]),
            )

            await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

            expect(fetchCrossChainAssetGroupsMock).toHaveBeenCalledWith(
                ['1', '2'],
                'mainnet',
            )
            expect(persisted()).toEqual([USDC_GROUP, null])
        })

        test('leaves the group of an id the v4 read omits alone', async () => {
            fetchCrossChainAssetGroupsMock.mockResolvedValueOnce(
                new Map<string, unknown>([['2', null]]),
            )

            await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

            expect(persisted()).toEqual([undefined, null])
        })

        test('still persists the batch, leaving each stored group alone, when the v4 read fails', async () => {
            fetchCrossChainAssetGroupsMock.mockRejectedValueOnce(
                new Error('integrity'),
            )

            await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

            expect(persisted()).toEqual([undefined, undefined])
        })

        test('rechecks assets no sync has read the group of', async () => {
            await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

            expect(getStaleOrMissingAssetIdsMock).toHaveBeenCalledWith(
                expect.objectContaining({ recheckUnreadGroup: true }),
            )
        })

        test('skips the unread-group recheck while the group read cannot pass integrity', async () => {
            canCallIntegrityGuardedRouteMock.mockReturnValue(false)

            await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

            expect(getStaleOrMissingAssetIdsMock).toHaveBeenCalledWith(
                expect.objectContaining({ recheckUnreadGroup: false }),
            )
        })
    })

    test('filters out ALGO and short-circuits when the remaining list is empty', async () => {
        await fetchAndPersistAssets(['0'], MAINNET_SCOPE)

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('batches remaining ids into groups of ASSET_BULK_CHUNK_SIZE and upserts each batch', async () => {
        const ids = Array.from({ length: 250 }, (_, i) => String(i + 1))
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(ids, MAINNET_SCOPE)

        // 250 ids / 100 per batch = 3 batches
        expect(fetchAssetsMock).toHaveBeenCalledTimes(3)
        expect(upsertAssetsMock).toHaveBeenCalledTimes(3)
    })

    test('allSettled keeps going when individual batches fail', async () => {
        fetchAssetsMock
            .mockResolvedValueOnce({ results: [{ asset_id: 1 }] })
            .mockRejectedValueOnce(new Error('batch 2 failed'))

        await expect(
            fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE),
        ).resolves.toBeUndefined()
    })

    test('short-circuits when all ids are already cached and fresh', async () => {
        getStaleOrMissingAssetIdsMock.mockResolvedValueOnce([])

        await fetchAndPersistAssets(['1', '2', '3'], MAINNET_SCOPE)

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('opts the freshness gate into rechecking newly seen, unclassified assets', async () => {
        // Without these the gate answers from the 7-day TTL alone, and a
        // freshly minted NFT stays typed as a plain asset for a week even
        // after the backend's crawler classifies it.
        fetchAssetsMock.mockResolvedValue({ results: [] })

        await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

        expect(getStaleOrMissingAssetIdsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                ttlMs: ASSET_CACHE_TTL_MS,
                recheckUnclassified: {
                    ttlMs: ASSET_RECLASSIFY_TTL_MS,
                    windowMs: ASSET_NEWLY_SEEN_WINDOW_MS,
                    hasCollectibleShape: hasAlgorandNftShape,
                },
            }),
        )
    })

    test('opts the freshness gate into rechecking ARC19 collectibles', async () => {
        // ARC19 media is mutable via the manager's acfg; without this the
        // 7-day TTL keeps serving the pre-update media URL.
        fetchAssetsMock.mockResolvedValue({ results: [] })

        await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

        expect(getStaleOrMissingAssetIdsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                recheckArc19: { ttlMs: ARC19_COLLECTIBLE_RECHECK_TTL_MS },
            }),
        )
    })

    test('backfills missing collectible urls from the indexer', async () => {
        // The bulk endpoint has no url field, so ARC19-ness is invisible to
        // the recheck until the indexer is asked once. Urls are immutable
        // on-chain, so this is one lookup per collectible ever.
        getCollectibleIdsMissingUrlMock.mockResolvedValue(['7'])
        getStaleOrMissingAssetIdsMock.mockResolvedValue([])
        fetchIndexerAssetDetailsMock.mockResolvedValue({
            assetId: '7',
            decimals: 0,
            url: 'template-ipfs://{ipfscid:1:raw:reserve:sha2-256}',
        })

        await fetchAndPersistAssets(['7'], MAINNET_SCOPE)

        expect(fetchIndexerAssetDetailsMock).toHaveBeenCalledWith(
            '7',
            'mainnet',
        )
        expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
            items: [
                expect.objectContaining({
                    assetId: '7',
                    url: 'template-ipfs://{ipfscid:1:raw:reserve:sha2-256}',
                }),
            ],
            scope: MAINNET_SCOPE,
        })
    })

    test('records a chain-confirmed absent url as empty string, not null', async () => {
        // '' means "asked, the chain has no url" — NULL would make the
        // backfill re-ask the indexer about this asset on every pass.
        getCollectibleIdsMissingUrlMock.mockResolvedValue(['7'])
        getStaleOrMissingAssetIdsMock.mockResolvedValue([])
        fetchIndexerAssetDetailsMock.mockResolvedValue({
            assetId: '7',
            decimals: 0,
        })

        await fetchAndPersistAssets(['7'], MAINNET_SCOPE)

        expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
            items: [expect.objectContaining({ assetId: '7', url: '' })],
            scope: MAINNET_SCOPE,
        })
    })

    test('only fetches the IDs returned by getStaleOrMissingAssetIds', async () => {
        getStaleOrMissingAssetIdsMock.mockResolvedValueOnce(['2'])
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 2 }] })

        await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

        expect(fetchAssetsMock).toHaveBeenCalledTimes(1)
        expect(fetchAssetsMock).toHaveBeenCalledWith(['2'], 'mainnet', null)
    })

    // A network with real Pera services: the Pera backend describes THIS chain,
    // so it stays the single authoritative source for both tables. These two
    // assertions pin that the fallback handling below is a strict no-op here.
    describe.each(['mainnet', 'testnet'] as const)(
        '%s (own Pera deployment)',
        network => {
            test('writes both tables from the single Pera response and never touches the indexer', async () => {
                fetchAssetsMock.mockResolvedValue({
                    results: [{ assetId: '1002', decimals: 6 }],
                })

                await fetchAndPersistAssets(['1002'], {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: network,
                } as const)

                expect(upsertAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 6 }],
                    scope: {
                        chainId: ALGORAND_CHAIN_ID,
                        networkId: network,
                    } as const,
                })
                expect(fetchIndexerAssetDetailsMock).not.toHaveBeenCalled()
                expect(upsertNodeAssetsMock).not.toHaveBeenCalled()
                expect(upsertPeraAssetsMock).not.toHaveBeenCalled()
            })
        },
    )

    // The Critical case. On betanet/custom the Pera backend served is TestNet's,
    // so asset id N there is a DIFFERENT asset than id N on the active chain.
    // `assets_node` holds the chain intrinsics the send flow reads back for
    // displayUnitsToBaseUnits, so it must never carry the borrowed values.
    describe.each(['betanet', 'custom'] as const)(
        '%s (borrowed Pera services)',
        network => {
            test('sources assets_node from the active chain indexer, never from the borrowed Pera backend', async () => {
                fetchAssetsMock.mockResolvedValue({
                    results: [
                        { assetId: '1002', decimals: 6, name: 'TestNet' },
                    ],
                })
                fetchIndexerAssetDetailsMock.mockResolvedValue({
                    assetId: '1002',
                    decimals: 0,
                    name: 'MYTOKEN',
                })

                await fetchAndPersistAssets(['1002'], {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: network,
                } as const)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 0, name: 'MYTOKEN' }],
                    scope: {
                        chainId: ALGORAND_CHAIN_ID,
                        networkId: network,
                    } as const,
                })
                // The whole-row writer must not run at all here — it would put
                // the borrowed decimals straight into assets_node.
                expect(upsertAssetsMock).not.toHaveBeenCalled()
            })

            test('writes no assets_node row at all when the chain lookup fails, rather than falling back to the borrowed value', async () => {
                fetchAssetsMock.mockResolvedValue({
                    results: [{ assetId: '1002', decimals: 6 }],
                })
                fetchIndexerAssetDetailsMock.mockRejectedValue(
                    new Error('no such asset on this chain'),
                )

                await fetchAndPersistAssets(['1002'], {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: network,
                } as const)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [],
                    scope: {
                        chainId: ALGORAND_CHAIN_ID,
                        networkId: network,
                    } as const,
                })
                expect(upsertAssetsMock).not.toHaveBeenCalled()
            })

            test('a failing Pera fetch does not stop the chain intrinsics from being persisted', async () => {
                fetchAssetsMock.mockRejectedValue(new Error('pera down'))
                fetchIndexerAssetDetailsMock.mockResolvedValue({
                    assetId: '1002',
                    decimals: 0,
                })

                await fetchAndPersistAssets(['1002'], {
                    chainId: ALGORAND_CHAIN_ID,
                    networkId: network,
                } as const)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 0 }],
                    scope: {
                        chainId: ALGORAND_CHAIN_ID,
                        networkId: network,
                    } as const,
                })
            })
        },
    )

    test('a non-Pera network writes only assets_node, and never calls the Pera bulk endpoint', async () => {
        getStaleOrMissingAssetIdsMock.mockResolvedValue(['123'])
        fetchIndexerAssetDetailsMock.mockResolvedValue({
            index: '123',
            params: { decimals: 3 },
        })

        await fetchAndPersistAssets(['123'], {
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'betanet',
        } as const)

        expect(upsertNodeAssetsMock).toHaveBeenCalled()
        // The borrowed-opinion half is gone entirely: not attempted, not
        // swallowed by allSettled.
        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertPeraAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    describe('v4 asset sync enabled', () => {
        const item = (assetId: string) => ({ asset_id: `asa:${assetId}` })

        beforeEach(() => {
            isV4AssetSyncEnabledMock.mockReturnValue(true)
            fetchAssetItemsMock.mockImplementation(
                async (ids: string[]) =>
                    new Map(ids.map(id => [id, item(id)] as const)),
            )
        })

        test('reads each batch with one v4 request and nothing else', async () => {
            deviceIdGetMock.mockReturnValue('4567123498765432101')

            await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

            expect(fetchAssetItemsMock).toHaveBeenCalledTimes(1)
            expect(fetchAssetItemsMock).toHaveBeenCalledWith(
                ['1', '2'],
                'mainnet',
                '4567123498765432101',
            )
            expect(fetchAssetsMock).not.toHaveBeenCalled()
            expect(fetchCrossChainAssetGroupsMock).not.toHaveBeenCalled()
            expect(upsertAssetsMock).toHaveBeenCalledWith({
                items: [{ assetId: '1' }, { assetId: '2' }],
                scope: MAINNET_SCOPE,
            })
        })

        test('makes one request per batch', async () => {
            const ids = Array.from({ length: 250 }, (_, i) => String(i + 1))

            await fetchAndPersistAssets(ids, MAINNET_SCOPE)

            expect(fetchAssetItemsMock).toHaveBeenCalledTimes(3)
            expect(fetchAssetsMock).not.toHaveBeenCalled()
        })

        test.each([
            ['555', true],
            [null, false],
        ])(
            'with device id %s, reads the device fields only when scoped (%s)',
            async (deviceId, isDeviceScoped) => {
                deviceIdGetMock.mockReturnValue(deviceId)

                await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

                expect(transformAssetItemResponseMock).toHaveBeenCalledWith(
                    '1',
                    item('1'),
                    { isDeviceScoped },
                )
            },
        )

        test('skips an item the transform cannot use', async () => {
            transformAssetItemResponseMock.mockImplementationOnce(() => null)

            await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)

            expect(upsertAssetsMock).toHaveBeenCalledWith({
                items: [{ assetId: '2' }],
                scope: MAINNET_SCOPE,
            })
        })

        test('a failed read writes nothing for that batch and the others still persist', async () => {
            const ids = Array.from({ length: 150 }, (_, i) => String(i + 1))
            fetchAssetItemsMock.mockRejectedValueOnce(
                new Error('device_not_found'),
            )

            await expect(
                fetchAndPersistAssets(ids, MAINNET_SCOPE),
            ).resolves.toBeUndefined()

            expect(fetchAssetItemsMock).toHaveBeenCalledTimes(2)
            expect(upsertAssetsMock).toHaveBeenCalledTimes(1)
            expect(upsertAssetsMock.mock.lastCall?.[0].items).toHaveLength(50)
        })

        test('still rechecks unread groups only while integrity can pass', async () => {
            canCallIntegrityGuardedRouteMock.mockReturnValue(false)

            await fetchAndPersistAssets(['1'], MAINNET_SCOPE)

            expect(getStaleOrMissingAssetIdsMock).toHaveBeenCalledWith(
                expect.objectContaining({ recheckUnreadGroup: false }),
            )
        })

        test('a non-Pera network still reads only the chain indexer', async () => {
            fetchIndexerAssetDetailsMock.mockResolvedValue({ assetId: '1' })

            await fetchAndPersistAssets(['1'], {
                chainId: ALGORAND_CHAIN_ID,
                networkId: 'betanet',
            } as const)

            expect(fetchAssetItemsMock).not.toHaveBeenCalled()
            expect(upsertAssetsMock).not.toHaveBeenCalled()
        })
    })

    test('refuses a scope that is not an Algorand network before touching the DB', async () => {
        const foreign = {
            chainId: 'other',
            networkId: 'mainnet',
        } as unknown as ChainScope

        await expect(fetchAndPersistAssets(['1'], foreign)).rejects.toThrow(
            'Not an Algorand scope',
        )
        expect(getStaleOrMissingAssetIdsMock).not.toHaveBeenCalled()
        expect(fetchAssetsMock).not.toHaveBeenCalled()
    })
})

describe('through the adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getStaleOrMissingAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) => assetIds,
        )
        getCollectibleIdsMissingUrlMock.mockResolvedValue([])
        deviceIdGetMock.mockReturnValue('555')
        fetchAssetsMock.mockResolvedValue({
            results: [{ asset_id: 1 }, { asset_id: 2 }],
        })
        fetchIndexerAssetDetailsMock.mockImplementation(
            async (assetId: string) => ({
                assetId,
                params: { decimals: 3 },
            }),
        )
    })

    test('writes the same rows as a direct sync on a Pera-backed network', async () => {
        await fetchAndPersistAssets(['1', '2'], MAINNET_SCOPE)
        const direct = [...upsertAssetsMock.mock.calls]
        upsertAssetsMock.mockClear()

        await algorandAssetsAdapter.syncAssets(
            [ref('1'), ref('2')],
            MAINNET_SCOPE,
        )

        expect(direct.length).toBeGreaterThan(0)
        expect(upsertAssetsMock.mock.calls).toEqual(direct)
    })

    test('writes the same rows as a direct sync on a network with no Pera deployment', async () => {
        const betanet = {
            chainId: ALGORAND_CHAIN_ID,
            networkId: 'betanet',
        } as const
        await fetchAndPersistAssets(['1', '2'], betanet)
        const direct = [...upsertNodeAssetsMock.mock.calls]
        upsertNodeAssetsMock.mockClear()

        await algorandAssetsAdapter.syncAssets([ref('1'), ref('2')], betanet)

        expect(direct.length).toBeGreaterThan(0)
        expect(upsertNodeAssetsMock.mock.calls).toEqual(direct)
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('rejects a foreign ref before any request', async () => {
        await expect(
            algorandAssetsAdapter.syncAssets(
                [{ chainId: 'ethereum', assetId: '0xabc' }],
                MAINNET_SCOPE,
            ),
        ).rejects.toThrow('Not an Algorand asset')

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(getStaleOrMissingAssetIdsMock).not.toHaveBeenCalled()
    })
})
