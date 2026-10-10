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

import { describe, expect, it } from 'vitest'
import { unknownAssetItem } from '../msw-handlers'
import { assetItemSchema, type AssetItemResponse } from '../schema'
import { toAssetMetadata, toPriceRow } from '../transformers'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const usdc: AssetItemResponse = {
    asset_id: USDC_CAIP19,
    type: 'erc20',
    name: 'USD Coin',
    unit_name: 'USDC',
    fraction_decimals: 6,
    logo: 'https://pera.test/usdc.png',
    usd_value: '1.000100000000000000000000',
    last_24_hours_usd_price_change_percentage: 0.01,
    is_verified: true,
    verification_tier: 'verified',
    explorer_url: null,
}

const item = (response: AssetItemResponse) => assetItemSchema.parse(response)

describe('toAssetMetadata', () => {
    it('maps an item to a PeraAsset under the requested app id', () => {
        const { assetId, asset, isQuarantined } = toAssetMetadata(
            USDC,
            item(usdc),
        )

        expect(assetId).toBe(USDC)
        expect(asset).toMatchObject({
            assetId: USDC,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            creator: { address: '' },
            peraMetadata: {
                verificationTier: 'verified',
                logo: 'https://pera.test/usdc.png',
                type: 'standard_asset',
            },
        })
        expect(asset!.totalSupply.toFixed()).toBe('0')
        expect(isQuarantined).toBe(false)
    })

    // upsertPeraAssets keeps the local favourite and price alert only when
    // the incoming value is absent.
    it('leaves the device-local flags unset', () => {
        const { asset } = toAssetMetadata(USDC, item(usdc))

        expect(asset!.peraMetadata).not.toHaveProperty('isFavorited')
        expect(asset!.peraMetadata).not.toHaveProperty('isPriceAlertEnabled')
    })

    it('reports a suspicious item with no metadata as quarantined', () => {
        expect(
            toAssetMetadata(
                USDC,
                item({
                    ...unknownAssetItem(USDC_CAIP19),
                    verification_tier: 'suspicious',
                }),
            ),
        ).toEqual({ assetId: USDC, asset: null, isQuarantined: true })
    })

    it('reports an item with no decimals as unknown', () => {
        expect(
            toAssetMetadata(USDC, item({ ...usdc, fraction_decimals: null })),
        ).toEqual({ assetId: USDC, asset: null, isQuarantined: false })
    })
})

describe('toPriceRow', () => {
    it('keeps every digit of the USD value', () => {
        const row = toPriceRow(USDC, item(usdc))

        expect(row?.assetId).toBe(USDC)
        expect(row?.usdPrice.toFixed()).toBe('1.0001')
    })

    it('reports no price as a miss, never zero', () => {
        expect(toPriceRow(USDC, item({ ...usdc, usd_value: null }))).toBeNull()
    })
})
