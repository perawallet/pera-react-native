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

import { describe, test, expect } from 'vitest'
import { transformSearchResult } from '../mappers'
import type { AssetSearchResultResponse } from '../../api/assets/search-schema'

describe('transformSearchResult', () => {
    test('maps a standard asset search result to camelCase with null fallbacks', () => {
        const input = {
            asset_id: 123,
            name: 'Test',
            unit_name: 'TST',
            logo: null,
            verification_tier: 'trusted',
            usd_value: '1.5',
            type: 'standard_asset',
        } as AssetSearchResultResponse

        const result = transformSearchResult(input)

        expect(result).toEqual({
            assetId: '123',
            name: 'Test',
            unitName: 'TST',
            logo: null,
            verificationTier: 'trusted',
            usdValue: '1.5',
            type: 'standard_asset',
            collectibleTitle: null,
            collectibleImage: null,
            collectionName: null,
        })
    })

    test('maps collectible fields when present', () => {
        const input = {
            asset_id: 456,
            name: null,
            unit_name: null,
            logo: null,
            verification_tier: 'unverified',
            usd_value: null,
            type: 'collectible',
            collectible: {
                title: 'Penguin #42',
                primary_image: 'https://example.com/p.jpg',
                collection: { name: 'Penguins' },
            },
        } as AssetSearchResultResponse

        const result = transformSearchResult(input)

        expect(result.collectibleTitle).toBe('Penguin #42')
        expect(result.collectibleImage).toBe('https://example.com/p.jpg')
        expect(result.collectionName).toBe('Penguins')
    })
})
