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
import { isDecimalEqual } from '../decimal-config'

describe('isDecimalEqual', () => {
    test('returns true when both are null', () => {
        expect(isDecimalEqual(null, null)).toBe(true)
    })

    test('returns false when first is null and second is non-null', () => {
        expect(isDecimalEqual(null, new Decimal(1))).toBe(false)
    })

    test('returns false when first is non-null and second is null', () => {
        expect(isDecimalEqual(new Decimal(1), null)).toBe(false)
    })

    test('returns true for equal Decimal values', () => {
        expect(isDecimalEqual(new Decimal('1.5'), new Decimal('1.5'))).toBe(
            true,
        )
    })

    test('returns false for different Decimal values', () => {
        expect(isDecimalEqual(new Decimal('1.5'), new Decimal('2.5'))).toBe(
            false,
        )
    })

    test('returns true for same reference', () => {
        const value = new Decimal(42)
        expect(isDecimalEqual(value, value)).toBe(true)
    })

    test('returns true for numerically equal values with different representations', () => {
        expect(isDecimalEqual(new Decimal('1.0'), new Decimal('1.00'))).toBe(
            true,
        )
    })
})
