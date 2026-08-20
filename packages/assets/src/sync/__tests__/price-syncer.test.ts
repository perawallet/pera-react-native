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

const fetchAssetPricesMock = vi.hoisted(() => vi.fn())
const fetchPublicAssetDetailsMock = vi.hoisted(() => vi.fn())
const upsertAssetPricesMock = vi.hoisted(() => vi.fn())
const getStaleOrMissingPriceAssetIdsMock = vi.hoisted(() => vi.fn())
const recordPriceMissesMock = vi.hoisted(() => vi.fn())
const clearPriceMissesMock = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchAssetPrices: fetchAssetPricesMock,
    fetchPublicAssetDetails: fetchPublicAssetDetailsMock,
    ASSET_PRICES_MAX_IDS_PER_REQUEST: 100,
}))

vi.mock('../../db', () => ({
    upsertAssetPrices: upsertAssetPricesMock,
    getStaleOrMissingPriceAssetIds: getStaleOrMissingPriceAssetIdsMock,
    recordPriceMisses: recordPriceMissesMock,
    clearPriceMisses: clearPriceMissesMock,
}))

import { fetchAndPersistPrices } from '../price-syncer'

describe('fetchAndPersistPrices', () => {
    beforeEach(() => {
        fetchAssetPricesMock.mockReset()
        fetchPublicAssetDetailsMock.mockReset()
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
        expect(fetchAssetPricesMock).not.toHaveBeenCalled()
        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
    })

    test('fetches and persists prices for non-ALGO ids and the ALGO price separately', async () => {
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '123', price: '2.0', currency: 'USD' },
        ])
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })

        await fetchAndPersistPrices(['123', '0'], 'mainnet')

        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['123'], 'mainnet')
        expect(fetchPublicAssetDetailsMock).toHaveBeenCalledWith('0', 'mainnet')
        // 2 upserts: one for batch, one for ALGO
        expect(upsertAssetPricesMock).toHaveBeenCalledTimes(2)
    })

    test('defaults a missing usd_value to 0 for the ALGO price', async () => {
        fetchAssetPricesMock.mockResolvedValue([])
        fetchPublicAssetDetailsMock.mockResolvedValue({}) // no usd_value

        await fetchAndPersistPrices(['123'], 'mainnet')

        const algoCall = upsertAssetPricesMock.mock.calls.find(c =>
            c[0]?.prices?.some((p: { assetId: string }) => p.assetId === '0'),
        )
        expect(algoCall?.[0].prices[0].usdPrice.toString()).toBe('0')
    })

    test('skips the ALGO fetch when the ALGO price is fresh', async () => {
        // Fresh only for the ALGO lookup — batch ids stay stale.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '124', price: '2.0', currency: 'USD' },
        ])

        await fetchAndPersistPrices(['124', '0'], 'mainnet')

        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['124'], 'mainnet')
    })

    test('skips batch ids whose price row is still fresh', async () => {
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue(['456'])
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '456', price: '1.0', currency: 'USD' },
        ])
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })

        await fetchAndPersistPrices(['123', '456'], 'mainnet')

        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['456'], 'mainnet')
    })

    test('gates batch ids on the persisted miss window', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '777', price: '1.0', currency: 'USD' },
        ])

        await fetchAndPersistPrices(['777'], 'testnet')

        expect(getStaleOrMissingPriceAssetIdsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                assetIds: ['777'],
                network: 'testnet',
                missRetryMs: expect.any(Number),
            }),
        )
    })

    test('records a persisted miss for ids the endpoint returned a null price for', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.0', currency: 'USD' },
            { asset_id: '777', price: null, currency: 'USD' },
        ])

        await fetchAndPersistPrices(['555', '777'], 'testnet')

        expect(recordPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['777'],
            network: 'testnet',
        })
        const upserted = upsertAssetPricesMock.mock.calls.flatMap(
            c => c[0]?.prices ?? [],
        )
        expect(
            upserted.some((p: { assetId: string }) => p.assetId === '777'),
        ).toBe(false)
    })

    test('clears persisted misses for ids that returned a price', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.0', currency: 'USD' },
        ])

        await fetchAndPersistPrices(['555', '777'], 'testnet')

        expect(clearPriceMissesMock).toHaveBeenCalledWith({
            assetIds: ['555'],
            network: 'testnet',
        })
    })

    test('records nothing when every id returned a price', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.0', currency: 'USD' },
        ])

        await fetchAndPersistPrices(['555'], 'testnet')

        expect(recordPriceMissesMock).not.toHaveBeenCalled()
    })

    test('throws when every batch settles as rejected', async () => {
        fetchAssetPricesMock.mockRejectedValue(new Error('batch failed'))
        fetchPublicAssetDetailsMock.mockRejectedValue(
            new Error('algo lookup failed'),
        )

        await expect(fetchAndPersistPrices(['999'], 'mainnet')).rejects.toThrow(
            'All price sync batches failed',
        )
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['999'], 'mainnet')
    })

    test('records misses for every priceless id on a large portfolio (no cap)', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.2' })
        fetchAssetPricesMock.mockResolvedValue([])

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
        fetchAssetPricesMock.mockRejectedValue(new Error('batch failed'))

        await expect(
            fetchAndPersistPrices(['123', '0'], 'mainnet'),
        ).rejects.toThrow('All price sync batches failed')
    })

    test.each(['betanet', 'custom'] as const)(
        'no-ops without calling either Pera-backed endpoint on %s',
        async network => {
            await fetchAndPersistPrices(['123', '0'], network)

            expect(fetchAssetPricesMock).not.toHaveBeenCalled()
            expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
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
            fetchAssetPricesMock.mockResolvedValue([])

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
            fetchAssetPricesMock.mockResolvedValue([])

            await Promise.all([
                fetchAndPersistPrices(manyIds, 'mainnet'),
                fetchAndPersistPrices(manyIds, 'testnet'),
            ])

            const networks = getStaleOrMissingPriceAssetIdsMock.mock.calls.map(
                call => call[0].network as string,
            )
            expect(networks.filter(n => n === 'mainnet').length).toBe(2)
            expect(networks.filter(n => n === 'testnet').length).toBe(2)
        })

        test('small enrichment lists are not deduped against each other', async () => {
            getStaleOrMissingPriceAssetIdsMock.mockImplementation(
                async ({ assetIds }: { assetIds: string[] }) => assetIds,
            )
            fetchAssetPricesMock.mockResolvedValue([])

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
