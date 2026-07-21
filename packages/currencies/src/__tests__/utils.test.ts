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
import { Decimal } from 'decimal.js'
import { areRatesUsable, assetToFiatAmount, fiatToAssetAmount } from '../utils'

describe('fiatToAssetAmount', () => {
    it('divides by price × rate and floors to the asset decimals', () => {
        // 1 / (0.333333 × 0.9) = 3.3333… → floored to 2 dp
        const result = fiatToAssetAmount(
            new Decimal(1),
            new Decimal('0.333333'),
            new Decimal('0.9'),
            2,
        )
        expect(result?.toString()).toBe('3.33')
    })

    it('returns null when the denominator is zero', () => {
        const result = fiatToAssetAmount(
            new Decimal(1),
            new Decimal(0),
            new Decimal('0.9'),
            6,
        )
        expect(result).toBeNull()
    })
})

describe('assetToFiatAmount', () => {
    it('multiplies by price × rate and floors to fiat decimals', () => {
        // 10 × 0.2 × 0.9 = 1.8
        const result = assetToFiatAmount(
            new Decimal(10),
            new Decimal('0.2'),
            new Decimal('0.9'),
        )
        expect(result.toString()).toBe('1.8')
    })

    it('rounds down, never up', () => {
        // 1 × 0.999 × 1 = 0.999 → floored to 0.99
        const result = assetToFiatAmount(
            new Decimal(1),
            new Decimal('0.999'),
            new Decimal(1),
        )
        expect(result.toString()).toBe('0.99')
    })
})

describe('areRatesUsable', () => {
    const price = new Decimal('0.2')
    const rate = new Decimal('0.9')

    it('is true when both rates are positive and decimals are known', () => {
        expect(areRatesUsable(price, rate, 6)).toBe(true)
    })

    it.each([
        ['null price', null, rate, 6],
        ['zero price', new Decimal(0), rate, 6],
        ['null rate', price, null, 6],
        ['zero rate', price, new Decimal(0), 6],
        ['null decimals', price, rate, null],
    ] as const)('is false for %s', (_label, p, r, d) => {
        expect(areRatesUsable(p, r, d)).toBe(false)
    })
})
