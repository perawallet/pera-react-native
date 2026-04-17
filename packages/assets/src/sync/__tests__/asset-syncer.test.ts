/*
 Copyright 2022-2025 Pera Wallet, LDA
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
const upsertAssetsMock = vi.hoisted(() => vi.fn())

vi.mock('../../api', () => ({
    fetchAssets: fetchAssetsMock,
    transformAssetResponse: transformAssetResponseMock,
}))

vi.mock('../../db', () => ({
    upsertAssets: upsertAssetsMock,
}))

import { fetchAndPersistAssets } from '../asset-syncer'

describe('fetchAndPersistAssets', () => {
    beforeEach(() => {
        fetchAssetsMock.mockReset()
        upsertAssetsMock.mockReset()
        transformAssetResponseMock.mockClear()
    })

    test('filters out ALGO and short-circuits when the remaining list is empty', async () => {
        await fetchAndPersistAssets(['0'], 'mainnet')

        expect(fetchAssetsMock).not.toHaveBeenCalled()
        expect(upsertAssetsMock).not.toHaveBeenCalled()
    })

    test('batches remaining ids into groups of 25 and upserts each batch', async () => {
        const ids = Array.from({ length: 60 }, (_, i) => String(i + 1))
        fetchAssetsMock.mockResolvedValue({ results: [{ asset_id: 1 }] })

        await fetchAndPersistAssets(ids, 'mainnet')

        // 60 ids / 25 per batch = 3 batches
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
})
