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

import { describe, it, expect } from 'vitest'
import { transformProviderItem, transformTopPairItem } from '../transformers'
import type { ProviderItemApiResponse, TopPairItemApiResponse } from '../schema'

const apiAsset = (assetId: string) => ({
    asset_id: assetId,
    logo: null,
    name: `Asset ${assetId}`,
    unit_name: `A${assetId}`,
    total: '1000',
    fraction_decimals: 6,
    verification_tier: 'verified',
    usd_value: '1.00',
})

describe('transformProviderItem', () => {
    it('maps provider name, display name, and icon url', () => {
        const data = {
            name: 'tinyman',
            display_name: 'Tinyman',
            icon_url: 'https://cdn/tinyman.png',
        } as unknown as ProviderItemApiResponse

        expect(transformProviderItem(data)).toEqual({
            name: 'tinyman',
            displayName: 'Tinyman',
            iconUrl: 'https://cdn/tinyman.png',
        })
    })
})

describe('transformTopPairItem', () => {
    it('transforms both pair assets and passes through 24h volume', () => {
        const data = {
            asset_a: apiAsset('0'),
            asset_b: apiAsset('31566704'),
            volume_24h_usd: '987654.32',
        } as unknown as TopPairItemApiResponse

        const result = transformTopPairItem(data)

        expect(result.assetA.assetId).toBe('0')
        expect(result.assetB.assetId).toBe('31566704')
        expect(result.volume24hUsd).toBe('987654.32')
    })
})
