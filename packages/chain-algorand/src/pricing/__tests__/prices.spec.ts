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

import { beforeEach, describe, expect, test, vi } from 'vitest'

const fetchAssetPricesMock = vi.hoisted(() => vi.fn())
const fetchPublicAssetDetailsMock = vi.hoisted(() => vi.fn())

vi.mock('../endpoints', () => ({ fetchAssetPrices: fetchAssetPricesMock }))
vi.mock('../../assets/api', () => ({
    fetchPublicAssetDetails: fetchPublicAssetDetailsMock,
}))

import { fetchNativeUsdPrice, fetchUsdPrices } from '../prices'

describe('fetchNativeUsdPrice', () => {
    beforeEach(() => {
        fetchPublicAssetDetailsMock.mockReset()
    })

    test('reads the public details of the native asset', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })

        const price = await fetchNativeUsdPrice('mainnet')

        expect(fetchPublicAssetDetailsMock).toHaveBeenCalledWith('0', 'mainnet')
        expect(price.toString()).toBe('0.2')
    })

    test('treats a missing usd_value as 0', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({})

        const price = await fetchNativeUsdPrice('mainnet')

        expect(price.toString()).toBe('0')
    })
})

describe('fetchUsdPrices', () => {
    beforeEach(() => {
        fetchAssetPricesMock.mockReset()
    })

    test('drops rows with a null price', async () => {
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.5', currency: 'USD' },
            { asset_id: '777', price: null, currency: 'USD' },
        ])

        const rows = await fetchUsdPrices(['555', '777'], 'testnet')

        expect(fetchAssetPricesMock).toHaveBeenCalledWith(
            ['555', '777'],
            'testnet',
        )
        expect(rows).toHaveLength(1)
        expect(rows[0].assetId).toBe('555')
        expect(rows[0].usdPrice.toString()).toBe('1.5')
    })
})
