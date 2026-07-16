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

vi.mock('../../api', () => ({
    fetchAssetPrices: fetchAssetPricesMock,
    fetchPublicAssetDetails: fetchPublicAssetDetailsMock,
}))

vi.mock('../../db', () => ({
    upsertAssetPrices: upsertAssetPricesMock,
    getStaleOrMissingPriceAssetIds: getStaleOrMissingPriceAssetIdsMock,
}))

import { fetchAndPersistPrices } from '../price-syncer'

describe('fetchAndPersistPrices', () => {
    beforeEach(() => {
        fetchAssetPricesMock.mockReset()
        fetchPublicAssetDetailsMock.mockReset()
        upsertAssetPricesMock.mockReset()
        getStaleOrMissingPriceAssetIdsMock.mockReset()
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
        fetchAssetPricesMock.mockResolvedValue({
            results: [{ asset_id: 123, usd_value: '2.0' }],
        })
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })

        await fetchAndPersistPrices(['123', '0'], 'mainnet')

        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['123'], 'mainnet')
        expect(fetchPublicAssetDetailsMock).toHaveBeenCalledWith('0', 'mainnet')
        // 2 upserts: one for batch, one for ALGO
        expect(upsertAssetPricesMock).toHaveBeenCalledTimes(2)
    })

    test('defaults a missing usd_value to 0 for the ALGO price', async () => {
        fetchAssetPricesMock.mockResolvedValue({ results: [] })
        fetchPublicAssetDetailsMock.mockResolvedValue({}) // no usd_value

        await fetchAndPersistPrices(['123'], 'mainnet')

        const algoCall = upsertAssetPricesMock.mock.calls.find(c =>
            c[0]?.prices?.some((p: { assetId: string }) => p.assetId === '0'),
        )
        expect(algoCall?.[0].prices[0].usdPrice.toString()).toBe('0')
    })

    test('skips the ALGO fetch when the ALGO price is fresh', async () => {
        // Fresh only for the ALGO lookup — batch ids stay stale. Distinct id:
        // '123' gets tombstoned on mainnet by an earlier miss in this file.
        getStaleOrMissingPriceAssetIdsMock.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.includes('0') ? [] : assetIds,
        )
        fetchAssetPricesMock.mockResolvedValue({
            results: [{ asset_id: 124, usd_value: '2.0' }],
        })

        await fetchAndPersistPrices(['124', '0'], 'mainnet')

        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['124'], 'mainnet')
    })

    test('skips batch ids whose price row is still fresh', async () => {
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue(['456'])
        fetchAssetPricesMock.mockResolvedValue({
            results: [{ asset_id: 456, usd_value: '1.0' }],
        })
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })

        await fetchAndPersistPrices(['123', '456'], 'mainnet')

        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['456'], 'mainnet')
    })

    test('does not refetch ids the endpoint returned no price for', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue({ results: [] })

        await fetchAndPersistPrices(['777'], 'testnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledTimes(1)

        await fetchAndPersistPrices(['777'], 'testnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledTimes(1)
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

    test('scopes miss tombstones to the network they were observed on', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue({ results: [] })

        await fetchAndPersistPrices(['888'], 'testnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledTimes(1)

        await fetchAndPersistPrices(['888'], 'mainnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledTimes(2)
        expect(fetchAssetPricesMock).toHaveBeenLastCalledWith(
            ['888'],
            'mainnet',
        )
    })

    test('evicts the oldest tombstone once the cap is reached', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.2' })
        fetchAssetPricesMock.mockResolvedValue({ results: [] })

        await fetchAndPersistPrices(['cap-seed'], 'mainnet')

        // Overflow the cap with fresh misses; the seed is among the oldest
        // entries and must be evicted…
        const filler = Array.from({ length: 520 }, (_, i) => `cap-${i}`)
        await fetchAndPersistPrices(filler, 'mainnet')

        // …making it fetchable again without waiting out the retry window.
        fetchAssetPricesMock.mockClear()
        await fetchAndPersistPrices(['cap-seed'], 'mainnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(
            ['cap-seed'],
            'mainnet',
        )
    })

    test('clears the tombstone once the endpoint returns a price again', async () => {
        vi.useFakeTimers()
        try {
            fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.2' })
            fetchAssetPricesMock.mockResolvedValue({ results: [] })

            // Miss → tombstoned.
            await fetchAndPersistPrices(['555'], 'mainnet')
            expect(fetchAssetPricesMock).toHaveBeenCalledTimes(1)

            // Past the retry window the id is refetched and now returns a
            // price, which must clear the tombstone…
            vi.advanceTimersByTime(11 * 60 * 1000)
            fetchAssetPricesMock.mockResolvedValue({
                results: [{ asset_id: 555, usd_value: '3.0' }],
            })
            await fetchAndPersistPrices(['555'], 'mainnet')
            expect(fetchAssetPricesMock).toHaveBeenCalledTimes(2)

            // …so the next pass fetches immediately instead of waiting out
            // another window.
            await fetchAndPersistPrices(['555'], 'mainnet')
            expect(fetchAssetPricesMock).toHaveBeenCalledTimes(3)
        } finally {
            vi.useRealTimers()
        }
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
})
