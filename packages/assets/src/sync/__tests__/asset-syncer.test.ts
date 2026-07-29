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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const fetchAssetsMock = vi.hoisted(() => vi.fn())
const transformAssetResponseMock = vi.hoisted(() => vi.fn(a => a))
const fetchIndexerAssetDetailsMock = vi.hoisted(() => vi.fn())
const transformIndexerAssetResponseMock = vi.hoisted(() => vi.fn(a => a))
const upsertAssetsMock = vi.hoisted(() => vi.fn())
const upsertNodeAssetsMock = vi.hoisted(() => vi.fn())
const upsertPeraAssetsMock = vi.hoisted(() => vi.fn())
const getStaleOrMissingAssetIdsMock = vi.hoisted(() =>
    vi.fn(async ({ assetIds }: { assetIds: string[] }) => assetIds),
)

vi.mock('../../api', () => ({
    fetchAssets: fetchAssetsMock,
    transformAssetResponse: transformAssetResponseMock,
    fetchIndexerAssetDetails: fetchIndexerAssetDetailsMock,
    transformIndexerAssetResponse: transformIndexerAssetResponseMock,
}))

vi.mock('../../db', () => ({
    upsertAssets: upsertAssetsMock,
    upsertNodeAssets: upsertNodeAssetsMock,
    upsertPeraAssets: upsertPeraAssetsMock,
    getStaleOrMissingAssetIds: getStaleOrMissingAssetIdsMock,
}))

const deviceIdGetMock = vi.hoisted(() => vi.fn(() => null as string | null))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: {
        getState: () => ({ deviceIDs: { get: deviceIdGetMock } }),
    },
}))

import { fetchAndPersistAssets } from '../asset-syncer'

describe('fetchAndPersistAssets', () => {
    beforeEach(() => {
        fetchAssetsMock.mockReset()
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
        deviceIdGetMock.mockReset()
        deviceIdGetMock.mockReturnValue(null)
    })

    test('device-scoped: passes the network device id to fetchAssets', async () => {
        deviceIdGetMock.mockReturnValue('555')
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(['1', '2'], 'mainnet')

        expect(fetchAssetsMock).toHaveBeenCalledWith(
            ['1', '2'],
            'mainnet',
            '555',
        )
    })

    test('no device id: fetches without device scoping', async () => {
        deviceIdGetMock.mockReturnValue(null)
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(['1', '2'], 'mainnet')

        expect(fetchAssetsMock).toHaveBeenCalledWith(
            ['1', '2'],
            'mainnet',
            null,
        )
    })

    test('filters out ALGO and short-circuits when the remaining list is empty', async () => {
        await fetchAndPersistAssets(['0'], 'mainnet')

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('batches remaining ids into groups of ASSET_BULK_CHUNK_SIZE and upserts each batch', async () => {
        const ids = Array.from({ length: 250 }, (_, i) => String(i + 1))
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(ids, 'mainnet')

        // 250 ids / 100 per batch = 3 batches
        expect(fetchAssetsMock).toHaveBeenCalledTimes(3)
        expect(upsertAssetsMock).toHaveBeenCalledTimes(3)
    })

    test('allSettled keeps going when individual batches fail', async () => {
        fetchAssetsMock
            .mockResolvedValueOnce({ results: [{ asset_id: 1 }] })
            .mockRejectedValueOnce(new Error('batch 2 failed'))

        await expect(
            fetchAndPersistAssets(['1', '2'], 'mainnet'),
        ).resolves.toBeUndefined()
    })

    test('short-circuits when all ids are already cached and fresh', async () => {
        getStaleOrMissingAssetIdsMock.mockResolvedValueOnce([])

        await fetchAndPersistAssets(['1', '2', '3'], 'mainnet')

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('only fetches the IDs returned by getStaleOrMissingAssetIds', async () => {
        getStaleOrMissingAssetIdsMock.mockResolvedValueOnce(['2'])
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 2 }] })

        await fetchAndPersistAssets(['1', '2'], 'mainnet')

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

                await fetchAndPersistAssets(['1002'], network)

                expect(upsertAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 6 }],
                    network,
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

                await fetchAndPersistAssets(['1002'], network)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 0, name: 'MYTOKEN' }],
                    network,
                })
                // The whole-row writer must not run at all here — it would put
                // the borrowed decimals straight into assets_node.
                expect(upsertAssetsMock).not.toHaveBeenCalled()
            })

            test('still writes Pera opinion fields to assets_pera', async () => {
                fetchAssetsMock.mockResolvedValue({
                    results: [{ assetId: '1002', decimals: 6 }],
                })
                fetchIndexerAssetDetailsMock.mockResolvedValue({
                    assetId: '1002',
                    decimals: 0,
                })

                await fetchAndPersistAssets(['1002'], network)

                expect(upsertPeraAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 6 }],
                    network,
                })
            })

            test('writes no assets_node row at all when the chain lookup fails, rather than falling back to the borrowed value', async () => {
                fetchAssetsMock.mockResolvedValue({
                    results: [{ assetId: '1002', decimals: 6 }],
                })
                fetchIndexerAssetDetailsMock.mockRejectedValue(
                    new Error('no such asset on this chain'),
                )

                await fetchAndPersistAssets(['1002'], network)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [],
                    network,
                })
                expect(upsertAssetsMock).not.toHaveBeenCalled()
            })

            test('a failing Pera fetch does not stop the chain intrinsics from being persisted', async () => {
                fetchAssetsMock.mockRejectedValue(new Error('pera down'))
                fetchIndexerAssetDetailsMock.mockResolvedValue({
                    assetId: '1002',
                    decimals: 0,
                })

                await fetchAndPersistAssets(['1002'], network)

                expect(upsertNodeAssetsMock).toHaveBeenCalledWith({
                    items: [{ assetId: '1002', decimals: 0 }],
                    network,
                })
            })
        },
    )
})
