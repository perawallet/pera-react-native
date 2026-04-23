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
import { Decimal } from 'decimal.js'
import {
    transformAssetPriceResponse,
    transformAssetPriceHistoryResponse,
} from '../transformers'

describe('transformAssetPriceResponse', () => {
    test('maps asset_id to string and usd_value to Decimal', () => {
        const result = transformAssetPriceResponse({
            asset_id: 123,
            usd_value: '1.23',
        })

        expect(result.assetId).toBe('123')
        expect(result.usdPrice).toBeInstanceOf(Decimal)
        expect(result.usdPrice.toString()).toBe('1.23')
    })

    test('defaults usd_value to 0 when null', () => {
        const result = transformAssetPriceResponse({
            asset_id: 456,
            usd_value: null,
        })

        expect(result.usdPrice.toString()).toBe('0')
    })

    test('defaults usd_value to 0 when undefined', () => {
        const result = transformAssetPriceResponse({
            asset_id: 789,
        })

        expect(result.usdPrice.toString()).toBe('0')
    })

    test('accepts string asset_id', () => {
        const result = transformAssetPriceResponse({
            asset_id: '0',
            usd_value: '0.10',
        })

        expect(result.assetId).toBe('0')
        expect(result.usdPrice.toString()).toBe('0.1')
    })
})

describe('transformAssetPriceHistoryResponse', () => {
    test('maps datetime to Date and price to Decimal', () => {
        const result = transformAssetPriceHistoryResponse({
            datetime: '2025-01-15T12:00:00Z',
            price: 2.5,
        })

        expect(result.datetime).toBeInstanceOf(Date)
        expect(result.datetime.toISOString()).toBe('2025-01-15T12:00:00.000Z')
        expect(result.usdPrice).toBeInstanceOf(Decimal)
        expect(result.usdPrice.toString()).toBe('2.5')
    })

    test('defaults price to 0 when nullish', () => {
        const result = transformAssetPriceHistoryResponse({
            datetime: '2025-01-15T12:00:00Z',
            price: null as unknown as number,
        })

        expect(result.usdPrice.toString()).toBe('0')
    })
})
