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

import { describe, expect, test } from 'vitest'
import { Decimal } from 'decimal.js'
import { abbreviateLargeAmount } from '../amount-abbreviation'

const abbreviate = (value: string, precision = 2) => {
    const { amount, unit } = abbreviateLargeAmount(
        new Decimal(value),
        precision,
    )
    return { amount: amount.toString(), unit }
}

describe('abbreviateLargeAmount', () => {
    test('leaves an amount under a million as it is', () => {
        expect(abbreviate('999999.99')).toEqual({
            amount: '999999.99',
            unit: '',
        })
    })

    test.each([
        ['1000000', '1', 'M'],
        ['1437766.91', '1.43776691', 'M'],
        ['2500000000', '2.5', 'B'],
        ['11061586259289.03', '11.06158625928903', 'T'],
        ['11061586259289000', '11061.586259289', 'T'],
    ])('abbreviates %s to %s%s', (value, amount, unit) => {
        expect(abbreviate(value)).toEqual({ amount, unit })
    })

    test('abbreviates a negative amount by its magnitude', () => {
        expect(abbreviate('-1500000')).toEqual({ amount: '-1.5', unit: 'M' })
    })

    test('moves up a unit when rounding would show 1,000 of the smaller one', () => {
        expect(abbreviate('999999999.999')).toEqual({
            amount: '0.999999999999',
            unit: 'B',
        })
    })

    test('stays in the smaller unit when the rounded figure is under 1,000', () => {
        expect(abbreviate('999994999')).toEqual({
            amount: '999.994999',
            unit: 'M',
        })
    })
})
