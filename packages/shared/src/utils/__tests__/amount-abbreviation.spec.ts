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

const abbreviate = (
    value: string,
    options?: Parameters<typeof abbreviateLargeAmount>[2],
) => {
    const { amount, unit } = abbreviateLargeAmount(
        new Decimal(value),
        2,
        options,
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
        ['1437766.91', '1.44', 'M'],
        ['2500000000', '2.5', 'B'],
        ['11061586259289.03', '11.06', 'T'],
        ['11061586259289000', '11061.59', 'T'],
    ])('abbreviates %s to %s%s', (value, amount, unit) => {
        expect(abbreviate(value)).toEqual({ amount, unit })
    })

    test('abbreviates a negative amount by its magnitude', () => {
        expect(abbreviate('-1500000')).toEqual({ amount: '-1.5', unit: 'M' })
    })

    test('moves up a unit when rounding would show 1,000 of the smaller one', () => {
        expect(abbreviate('999999999.999')).toEqual({
            amount: '1',
            unit: 'B',
        })
    })

    test('stays in the smaller unit when the rounded figure is under 1,000', () => {
        expect(abbreviate('999994999')).toEqual({
            amount: '999.99',
            unit: 'M',
        })
    })

    describe('from thousands', () => {
        test('leaves an amount under a thousand as it is', () => {
            expect(abbreviate('999.99', { from: 'K' })).toEqual({
                amount: '999.99',
                unit: '',
            })
        })

        test.each([
            ['1500', '1.5', 'K'],
            ['2500000', '2.5', 'M'],
        ])('abbreviates %s to %s%s', (value, amount, unit) => {
            expect(abbreviate(value, { from: 'K' })).toEqual({ amount, unit })
        })

        test('moves up to millions when rounding would show 1,000K', () => {
            expect(abbreviate('999999.999', { from: 'K' })).toEqual({
                amount: '1',
                unit: 'M',
            })
        })
    })

    describe('with a rounding mode', () => {
        test('rounds the scaled amount down, so it never reads above the original', () => {
            expect(
                abbreviate('1999999.995', { rounding: Decimal.ROUND_DOWN }),
            ).toEqual({ amount: '1.99', unit: 'M' })
        })

        test('keeps the smaller unit when rounding down stays under 1,000', () => {
            expect(
                abbreviate('999999999.996', { rounding: Decimal.ROUND_DOWN }),
            ).toEqual({ amount: '999.99', unit: 'M' })
        })

        test('leaves an amount below the first unit unrounded', () => {
            expect(
                abbreviate('123.456789', { rounding: Decimal.ROUND_DOWN }),
            ).toEqual({ amount: '123.456789', unit: '' })
        })
    })
})
