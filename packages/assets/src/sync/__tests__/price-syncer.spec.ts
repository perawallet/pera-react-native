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

const fetchUsdPricesMock = vi.hoisted(() => vi.fn())
const fetchNativeUsdPriceMock = vi.hoisted(() => vi.fn())
const upsertAssetPricesMock = vi.hoisted(() => vi.fn())
const getStaleOrMissingPriceAssetIdsMock = vi.hoisted(() => vi.fn())
const recordPriceMissesMock = vi.hoisted(() => vi.fn())
const clearPriceMissesMock = vi.hoisted(() => vi.fn())

vi.mock('../../db', () => ({
    upsertAssetPrices: upsertAssetPricesMock,
    getStaleOrMissingPriceAssetIds: getStaleOrMissingPriceAssetIdsMock,
    recordPriceMisses: recordPriceMissesMock,
    clearPriceMisses: clearPriceMissesMock,
}))

import { Decimal } from 'decimal.js'
import {
    ChainAdapterNotRegisteredError,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { assetsChainAdapters } from '../../chain-adapter'
import {
    fakeAssetsAdapter,
    registerFakeAssetsAdapter,
} from '../../__tests__/fakeAssetsChain'
import { fetchAndPersistPrices } from '../price-syncer'

const mainnetScope = { chainId: 'algorand', networkId: 'mainnet' }
const testnetScope = { chainId: 'algorand', networkId: 'testnet' }

const priced = (assetId: string, usdPrice: string) => ({
    assetId,
    usdPrice: new Decimal(usdPrice),
})

describe('fetchAndPersistPrices', () => {
    beforeEach(() => {
        fetchUsdPricesMock.mockReset()
        fetchNativeUsdPriceMock.mockReset()
        registerFakeAssetsAdapter({
            fetchUsdPrices: fetchUsdPricesMock,
            fetchNativeUsdPrice: fetchNativeUsdPriceMock,
        })
        upsertAssetPricesMock.mockReset()
        getStaleOrMissingPriceAssetIdsMock.mockReset()
        recordPriceMissesMock.mockReset()
        clearPriceMissesMock.mockReset()
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) => assetIds,
        )
    })

    test('no-ops on empty input', async () => {
        await fetchAndPersistPrices([], 'mainnet')
        expect(fetchUsdPricesMock).not.toHaveBeenCalled()
        expect(fetchNativeUsdPriceMock).not.toHaveBeenCalled()
    })

    test('fetches and persists prices for non-ALGO ids and the ALGO price separately', async () => {
        fetchUsdPricesMock.mockResolvedValue([priced('123', '2.0')])
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))

        await fetchAndPersistPrices(['123', '0'], 'mainnet')

        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['123'], mainnetScope)
        expect(fetchNativeUsdPriceMock).toHaveBeenCalledWith(mainnetScope)
        // 2 upserts: one for batch, one for ALGO
        expect(upsertAssetPricesMock).toHaveBeenCalledTimes(2)
    })

    test('skips the ALGO fetch when the ALGO price is fresh', async () => {
        // Fresh only for the ALGO lookup — batch ids stay stale.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        fetchUsdPricesMock.mockResolvedValue([priced('124', '2.0')])

        await fetchAndPersistPrices(['124', '0'], 'mainnet')

        expect(fetchNativeUsdPriceMock).not.toHaveBeenCalled()
        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['124'], mainnetScope)
    })

    test('skips batch ids whose price row is still fresh', async () => {
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue(['456'])
        fetchUsdPricesMock.mockResolvedValue([priced('456', '1.0')])
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))

        await fetchAndPersistPrices(['123', '456'], 'mainnet')

        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['456'], mainnetScope)
    })

    test('gates batch ids on the persisted miss window', async () => {
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([priced('777', '1.0')])

        await fetchAndPersistPrices(['777'], 'testnet')

        expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetIds: ['777'],
                scope: testnetScope,
                missRetryMs: expect.any(Number),
            }),
        )
    })

    test('records a persisted miss for ids the price source left out', async () => {
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([priced('555', '1.0')])

        await fetchAndPersistPrices(['555', '777'], 'testnet')

        expect(recordPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['777'],
            scope: testnetScope,
        })
        const upserted = upsertAssetPricesMock.mock.calls.flatMap(
            c => c[0]?.prices ?? [],
        )
        expect(
            upserted.some((p: { assetId: string }) => p.assetId === '777'),
        ).toBe(false)
    })

    test('clears persisted misses for ids that returned a price', async () => {
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([priced('555', '1.0')])

        await fetchAndPersistPrices(['555', '777'], 'testnet')

        expect(clearPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['555'],
            scope: testnetScope,
        })
    })

    test('records nothing when every id returned a price', async () => {
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([priced('555', '1.0')])

        await fetchAndPersistPrices(['555'], 'testnet')

        expect(recordPriceMissesMock).not.toHaveBeenCalled()
    })

    test('throws when every batch settles as rejected', async () => {
        fetchUsdPricesMock.mockRejectedValue(new Error('batch failed'))
        fetchNativeUsdPriceMock.mockRejectedValue(
            new Error('algo lookup failed'),
        )

        await expect(fetchAndPersistPrices(['999'], 'mainnet')).rejects.toThrow(
            'All price sync batches failed',
        )
        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['999'], mainnetScope)
    })

    test('records misses for every priceless id on a large portfolio (no cap)', async () => {
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.2'))
        fetchUsdPricesMock.mockResolvedValue([])

        const manyIds = Array.from({ length: 600 }, (_, i) => `${1000 + i}`)
        await fetchAndPersistPrices(manyIds, 'mainnet')

        const recorded = recordPriceMissesMock.mock.calls.flatMap(
            call => call[0].assetIds as string[],
        )
        expect(new Set(recorded).size).toBe(600)
    })

    test('still throws when ALGO was skipped fresh but every real batch failed', async () => {
        // Fresh only for the ALGO lookup — the batch must still be attempted.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        fetchUsdPricesMock.mockRejectedValue(new Error('batch failed'))

        await expect(
            fetchAndPersistPrices(['123', '0'], 'mainnet'),
        ).rejects.toThrow('All price sync batches failed')
    })

    test('sizes batches by the adapter limit', async () => {
        assetsChainAdapters.reset()
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                maxPriceIdsPerRequest: 2,
                fetchUsdPrices: fetchUsdPricesMock,
                fetchNativeUsdPrice: fetchNativeUsdPriceMock,
            }),
        )
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([])

        await fetchAndPersistPrices(['11', '12', '13'], 'mainnet')

        expect(fetchUsdPricesMock).toHaveBeenCalledWith(
            ['11', '12'],
            mainnetScope,
        )
        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['13'], mainnetScope)
    })

    test('treats the adapter native id, not a literal, as the native asset', async () => {
        assetsChainAdapters.reset()
        assetsChainAdapters.register(
            fakeAssetsAdapter({
                getNativeAsset: () => ({
                    ...fakeAssetsAdapter().getNativeAsset(),
                    assetId: 'native',
                }),
                fetchUsdPrices: fetchUsdPricesMock,
                fetchNativeUsdPrice: fetchNativeUsdPriceMock,
            }),
        )
        fetchNativeUsdPriceMock.mockResolvedValue(new Decimal('0.20'))
        fetchUsdPricesMock.mockResolvedValue([])

        await fetchAndPersistPrices(['native', '0'], 'mainnet')

        expect(fetchUsdPricesMock).toHaveBeenCalledWith(['0'], mainnetScope)
        expect(upsertAssetPricesMock).toHaveBeenCalledWith(
            expect.objectContaining({
                prices: [expect.objectContaining({ assetId: 'native' })],
            }),
        )
    })

    test.each(['mainnet', 'betanet'] as const)(
        'rejects when no adapter is registered, even on %s',
        async network => {
            assetsChainAdapters.reset()

            await expect(
                fetchAndPersistPrices(['123'], network),
            ).rejects.toBeInstanceOf(ChainAdapterNotRegisteredError)
        },
    )

    test.each(['betanet', 'custom'] as const)(
        'no-ops without calling either Pera-backed endpoint on %s',
        async network => {
            await fetchAndPersistPrices(['123', '0'], network)

            expect(fetchUsdPricesMock).not.toHaveBeenCalled()
            expect(fetchNativeUsdPriceMock).not.toHaveBeenCalled()
        },
    )

    describe('whole-wallet pass dedupe', () => {
        const manyIds = Array.from({ length: 1000 }, (_, i) => `${i + 1}`)

        test('concurrent large passes for one network share a single pass', async () => {
            // The gate resolves on a macrotask so the second call is issued
            // while the first pass is still in flight.
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            fetchUsdPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, 'mainnet'),
                fetchAndPersistPrices(manyIds, 'mainnet'),
            ])

            // One gate call for the batch path plus one for the ALGO check —
            // a second full pass would double both.
            expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledTimes(2)
        })

        test('large passes on different networks run independently', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                async ({ assetIds }: { assetIds: string[] }) => assetIds,
            )
            fetchUsdPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, 'mainnet'),
                fetchAndPersistPrices(manyIds, 'testnet'),
            ])

            const networks = getStaleOrMissingPriceAssetIdsMock.mock.calls.map(
                call => (call[0].scope as ChainScope).networkId,
            )
            expect(networks.filter(n => n === 'mainnet').length).toBe(2)
            expect(networks.filter(n => n === 'testnet').length).toBe(2)
        })

        test('a large pass joins an in-flight pass that covers all of its ids', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            fetchUsdPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, 'mainnet'),
                // A 300-asset account whose ids the whole-wallet pass already
                // covers — waiting on that pass prices everything it needs.
                fetchAndPersistPrices(manyIds.slice(0, 300), 'mainnet'),
            ])

            // Batch gate + ALGO gate for the single shared pass.
            expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledTimes(2)
        })

        test('a large pass with ids the in-flight pass never saw runs its own pass', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                ({ assetIds }: { assetIds: string[] }) =>
                    new Promise(resolve =>
                        setTimeout(() => resolve(assetIds), 10),
                    ),
            )
            fetchUsdPricesMock.mockResolvedValue([])

            // A freshly imported 300-asset account: joining the in-flight
            // whole-wallet pass would resolve without ever pricing its ids.
            const freshImportIds = Array.from(
                { length: 300 },
                (_, i) => `fresh-${i}`,
            )
            await Promise.all([
                fetchAndPersistPrices(manyIds, 'mainnet'),
                fetchAndPersistPrices(freshImportIds, 'mainnet'),
            ])

            const gatedIds =
                getStaleOrMissingPriceAssetIdsMock.mock.calls.flatMap(
                    call => call[0].assetIds as string[],
                )
            expect(gatedIds).toContain('fresh-0')
            expect(gatedIds).toContain('fresh-299')
        })

        test('small enrichment lists are not deduped against each other', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                async ({ assetIds }: { assetIds: string[] }) => assetIds,
            )
            fetchUsdPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(['123'], 'mainnet'),
                fetchAndPersistPrices(['456'], 'mainnet'),
            ])

            const batchGateIds =
                getStaleOrMissingPriceAssetIdsMock.mock.calls.flatMap(
                    call => call[0].assetIds as string[],
                )
            expect(batchGateIds).toContain('123')
            expect(batchGateIds).toContain('456')
        })
    })
})
