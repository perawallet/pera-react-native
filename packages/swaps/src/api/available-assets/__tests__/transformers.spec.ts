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
import { transformDexSwapAsset } from '../transformers'
import type { DexSwapAssetApiResponse } from '../schema'

const apiAsset = (
    overrides: Partial<DexSwapAssetApiResponse> = {},
): DexSwapAssetApiResponse =>
    ({
        asset_id: '31566704',
        logo: 'https://cdn/usdc.png',
        name: 'USD Coin',
        unit_name: 'USDC',
        total: '1000000000',
        fraction_decimals: 6,
        verification_tier: 'verified',
        usd_value: '1.00',
        ...overrides,
    }) as unknown as DexSwapAssetApiResponse

describe('transformDexSwapAsset', () => {
    it('maps snake_case API fields to the camelCase domain shape', () => {
        expect(transformDexSwapAsset(apiAsset())).toEqual({
            assetId: '31566704',
            logo: 'https://cdn/usdc.png',
            name: 'USD Coin',
            unitName: 'USDC',
            total: '1000000000',
            decimals: 6,
            verificationTier: 'verified',
            usdValue: '1.00',
        })
    })

    it('defaults a missing asset_id to "0" (ALGO sentinel)', () => {
        expect(
            transformDexSwapAsset(apiAsset({ asset_id: null })).assetId,
        ).toBe('0')
    })

    it('normalizes a null logo to undefined', () => {
        expect(
            transformDexSwapAsset(apiAsset({ logo: null })).logo,
        ).toBeUndefined()
    })
})
