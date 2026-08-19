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

import { describe, test, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import { transformAssetPriceHistoryResponse } from '../transformers'

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
