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

const queryClientMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        queryClient: queryClientMock,
    }
})

import { fetchAssetPrices, fetchAssetPriceHistory } from '../endpoints'

const validPrice = {
    asset_id: '123',
    price: '1.5',
    currency: 'USD',
}

describe('prices endpoints', () => {
    beforeEach(() => {
        queryClientMock.mockReset()
    })

    test('fetchAssetPrices hits /api/v3/asset-prices with comma-joined asset_ids', async () => {
        queryClientMock.mockResolvedValue({
            data: [
                validPrice,
                { asset_id: '456', price: null, currency: 'USD' },
            ],
        })

        const result = await fetchAssetPrices(['123', '456'], 'mainnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/api/v3/asset-prices',
                params: { asset_ids: '123,456' },
                network: 'mainnet',
            }),
        )
        expect(result).toEqual([
            { asset_id: '123', price: '1.5', currency: 'USD' },
            { asset_id: '456', price: null, currency: 'USD' },
        ])
    })

    test('fetchAssetPriceHistory hits /v1/assets/price-chart/ with asset_id and period', async () => {
        queryClientMock.mockResolvedValue({
            data: [],
        })

        await fetchAssetPriceHistory('123', '1D', 'testnet')

        expect(queryClientMock).toHaveBeenCalledWith(
            expect.objectContaining({
                url: '/v1/assets/price-chart/',
                params: { asset_id: '123', period: '1D' },
                network: 'testnet',
            }),
        )
    })

    test('fetchAssetPrices throws when response fails schema validation', async () => {
        queryClientMock.mockResolvedValue({ data: { bad: 'shape' } })

        await expect(fetchAssetPrices(['123'], 'mainnet')).rejects.toThrow()
    })
})
