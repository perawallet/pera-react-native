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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '../../models'

const mockFetchAndPersistAssets = vi.hoisted(() => vi.fn())
const mockGetAssetsByIds = vi.hoisted(() => vi.fn())

vi.mock('../../sync/asset-syncer', () => ({
    fetchAndPersistAssets: mockFetchAndPersistAssets,
}))

vi.mock('../../db', () => ({
    getAssetsByIds: mockGetAssetsByIds,
}))

import { assetBatchQueue } from '../assetBatchQueue'

const makeAsset = (assetId: string, name = `asset-${assetId}`): PeraAsset => ({
    assetId,
    decimals: 6,
    creator: { address: 'CREATOR' },
    totalSupply: new Decimal(1000),
    name,
    unitName: name.toUpperCase(),
})

describe('assetBatchQueue (adapter)', () => {
    beforeEach(() => {
        mockFetchAndPersistAssets.mockReset().mockResolvedValue(undefined)
        mockGetAssetsByIds.mockReset().mockResolvedValue([])
    })

    it('coalesces concurrent enqueues into one fetchAndPersistAssets call per network', async () => {
        const a = makeAsset('1', 'alpha')
        const b = makeAsset('2', 'beta')
        mockGetAssetsByIds.mockResolvedValue([a, b])

        const [r1, r2, r3] = await Promise.all([
            assetBatchQueue.enqueue('1', 'mainnet'),
            assetBatchQueue.enqueue('2', 'mainnet'),
            assetBatchQueue.enqueue('3', 'mainnet'),
        ])

        expect(mockFetchAndPersistAssets).toHaveBeenCalledTimes(1)
        const [ids, network] = mockFetchAndPersistAssets.mock.calls[0]
        expect(new Set(ids)).toEqual(new Set(['1', '2', '3']))
        expect(network).toBe('mainnet')

        expect(r1).toEqual(a)
        expect(r2).toEqual(b)
        // ID '3' was not in the re-read → waiter resolves with undefined.
        expect(r3).toBeUndefined()
    })

    it('separates batches per network', async () => {
        mockGetAssetsByIds.mockResolvedValue([])

        await Promise.all([
            assetBatchQueue.enqueue('1', 'mainnet'),
            assetBatchQueue.enqueue('2', 'testnet'),
        ])

        expect(mockFetchAndPersistAssets).toHaveBeenCalledTimes(2)
        const networks = mockFetchAndPersistAssets.mock.calls.map(c => c[1])
        expect(networks.sort()).toEqual(['mainnet', 'testnet'])
    })

    it('rejects waiters when fetchAndPersistAssets throws', async () => {
        mockFetchAndPersistAssets.mockRejectedValue(new Error('boom'))
        await expect(assetBatchQueue.enqueue('1', 'mainnet')).rejects.toThrow(
            'boom',
        )
    })

    it('resolves with undefined when getAssetsByIds returns no row for the key', async () => {
        mockGetAssetsByIds.mockResolvedValue([])

        const result = await assetBatchQueue.enqueue('1', 'mainnet')
        expect(result).toBeUndefined()
    })
})
