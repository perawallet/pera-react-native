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
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue(['0'])
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
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue([])
        fetchAssetPricesMock.mockResolvedValue({
            results: [{ asset_id: 123, usd_value: '2.0' }],
        })

        await fetchAndPersistPrices(['123', '0'], 'mainnet')

        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(['123'], 'mainnet')
    })

    test('throws when every batch settles as rejected', async () => {
        fetchAssetPricesMock.mockRejectedValue(new Error('batch failed'))
        fetchPublicAssetDetailsMock.mockRejectedValue(
            new Error('algo lookup failed'),
        )

        await expect(fetchAndPersistPrices(['123'], 'mainnet')).rejects.toThrow(
            'All price sync batches failed',
        )
    })

    test('still throws when ALGO was skipped fresh but every real batch failed', async () => {
        getStaleOrMissingPriceAssetIdsMock.mockResolvedValue([])
        fetchAssetPricesMock.mockRejectedValue(new Error('batch failed'))

        await expect(
            fetchAndPersistPrices(['123', '0'], 'mainnet'),
        ).rejects.toThrow('All price sync batches failed')
    })
})
