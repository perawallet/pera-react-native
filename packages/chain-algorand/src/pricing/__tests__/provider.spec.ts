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

import type { AssetRef } from '@perawallet/wallet-core-chain-contract'
import { fetchPeraUsdPrices } from '../provider'

const ref = (assetId: string): AssetRef => ({ chainId: 'algorand', assetId })

describe('fetchPeraUsdPrices', () => {
    beforeEach(() => {
        fetchAssetPricesMock.mockReset()
        fetchPublicAssetDetailsMock.mockReset()
    })

    test('prices ALGO from public details and ASAs from the bulk endpoint, keyed by the requested refs', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.20' })
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.5', currency: 'USD' },
            { asset_id: '777', price: '3', currency: 'USD' },
        ])
        const refs = [ref('0'), ref('555'), ref('777')]

        const prices = await fetchPeraUsdPrices(refs, 'mainnet')

        expect(fetchPublicAssetDetailsMock).toHaveBeenCalledWith('0', 'mainnet')
        expect(fetchAssetPricesMock).toHaveBeenCalledWith(
            ['555', '777'],
            'mainnet',
        )
        expect(prices.map(p => [p.assetRef, p.usdPrice.toString()])).toEqual([
            [refs[0], '0.2'],
            [refs[1], '1.5'],
            [refs[2], '3'],
        ])
    })

    test('drops a price: null row', async () => {
        fetchAssetPricesMock.mockResolvedValue([
            { asset_id: '555', price: '1.5', currency: 'USD' },
            { asset_id: '777', price: null, currency: 'USD' },
        ])

        const prices = await fetchPeraUsdPrices(
            [ref('555'), ref('777')],
            'testnet',
        )

        expect(prices).toHaveLength(1)
        expect(prices[0].assetRef).toEqual(ref('555'))
    })

    test.each([
        ['null', { usd_value: null }],
        ['absent', {}],
    ])('leaves ALGO out when usd_value is %s', async (_label, details) => {
        fetchPublicAssetDetailsMock.mockResolvedValue(details)

        await expect(
            fetchPeraUsdPrices([ref('0')], 'mainnet'),
        ).resolves.toEqual([])
    })

    test('makes no call for no refs', async () => {
        await expect(fetchPeraUsdPrices([], 'mainnet')).resolves.toEqual([])

        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
        expect(fetchAssetPricesMock).not.toHaveBeenCalled()
    })

    test('native-only makes no bulk call and tokens-only makes no details call', async () => {
        fetchPublicAssetDetailsMock.mockResolvedValue({ usd_value: '0.2' })
        fetchAssetPricesMock.mockResolvedValue([])

        await fetchPeraUsdPrices([ref('0')], 'mainnet')
        expect(fetchAssetPricesMock).not.toHaveBeenCalled()

        fetchPublicAssetDetailsMock.mockClear()
        await fetchPeraUsdPrices([ref('555')], 'mainnet')
        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
    })

    test('rejects a ref on another chain before any request', async () => {
        await expect(
            fetchPeraUsdPrices(
                [ref('555'), { chainId: 'ethereum', assetId: '0xabc' }],
                'mainnet',
            ),
        ).rejects.toThrow('Not an Algorand asset: ethereum/0xabc')

        expect(fetchPublicAssetDetailsMock).not.toHaveBeenCalled()
        expect(fetchAssetPricesMock).not.toHaveBeenCalled()
    })
})
