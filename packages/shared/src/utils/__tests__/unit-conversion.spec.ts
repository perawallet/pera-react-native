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
import {
    algosToMicroAlgos,
    algosToMicroAlgosBigInt,
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    displayUnitsToBaseUnitsBigInt,
    microAlgosToAlgos,
    toBigInt,
} from '../unit-conversion'
import { initDecimalConfig } from '../decimal-config'

const UINT64_MAX = 18_446_744_073_709_551_615n

initDecimalConfig()

describe('baseUnitsToDisplayUnits', () => {
    it('scales base units down by 10^decimals', () => {
        expect(baseUnitsToDisplayUnits(1_500_000n, 6).toString()).toBe('1.5')
    })

    it('accepts bigint, number, string and Decimal inputs alike', () => {
        const inputs = [123n, 123, '123', new Decimal(123)]

        const results = inputs.map(i =>
            baseUnitsToDisplayUnits(i, 2).toString(),
        )

        expect(results).toEqual(['1.23', '1.23', '1.23', '1.23'])
    })

    it('returns the amount unchanged for 0 decimals', () => {
        expect(baseUnitsToDisplayUnits(42n, 0).toString()).toBe('42')
    })

    it('keeps every digit of uint64 max at 19 decimals', () => {
        const result = baseUnitsToDisplayUnits(UINT64_MAX, 19)

        expect(result.toFixed()).toBe('1.8446744073709551615')
    })

    it('keeps the sign of negative amounts', () => {
        expect(baseUnitsToDisplayUnits(-1n, 6).toString()).toBe('-0.000001')
    })
})

describe('displayUnitsToBaseUnits', () => {
    it('scales display units up by 10^decimals', () => {
        expect(displayUnitsToBaseUnits('1.5', 6).toString()).toBe('1500000')
    })

    it('keeps a fraction beyond the asset decimals for the caller to handle', () => {
        expect(displayUnitsToBaseUnits('0.0000015', 6).toString()).toBe('1.5')
    })

    it('round-trips with baseUnitsToDisplayUnits', () => {
        const display = baseUnitsToDisplayUnits(UINT64_MAX, 6)

        expect(displayUnitsToBaseUnits(display, 6).toFixed()).toBe(
            UINT64_MAX.toString(),
        )
    })
})

describe('toBigInt', () => {
    it('converts an integral Decimal exactly', () => {
        expect(toBigInt(new Decimal(UINT64_MAX.toString()))).toBe(UINT64_MAX)
    })

    it.each([
        ['1.5', 1n],
        ['1.9', 1n],
        ['0.5', 0n],
        ['2.5', 2n],
    ])(
        'truncates %s to %s despite the global ROUND_HALF_UP',
        (input, expected) => {
            expect(toBigInt(new Decimal(input))).toBe(expected)
        },
    )

    it.each([
        ['-1.5', -1n],
        ['-1.9', -1n],
        ['-0.5', 0n],
    ])('truncates negative %s toward zero to %s', (input, expected) => {
        expect(toBigInt(new Decimal(input))).toBe(expected)
    })

    it('does not use exponent notation for large values', () => {
        expect(toBigInt(new Decimal('1e21'))).toBe(10n ** 21n)
    })

    it.each([NaN, Infinity, -Infinity])('throws on %s', value => {
        expect(() => toBigInt(new Decimal(value))).toThrow()
    })
})

describe('displayUnitsToBaseUnitsBigInt', () => {
    it('converts a display amount within the asset decimals exactly', () => {
        expect(displayUnitsToBaseUnitsBigInt('12.345678', 6)).toBe(12_345_678n)
    })

    it('truncates digits beyond the asset decimals instead of rounding up', () => {
        expect(displayUnitsToBaseUnitsBigInt('0.0000019', 6)).toBe(1n)
        expect(displayUnitsToBaseUnitsBigInt('1.99', 0)).toBe(1n)
    })
})

describe('ALGO conversions', () => {
    it('microAlgosToAlgos uses 6 decimals', () => {
        expect(microAlgosToAlgos(100_000n).toString()).toBe('0.1')
    })

    it('algosToMicroAlgos uses 6 decimals', () => {
        expect(algosToMicroAlgos('0.001').toString()).toBe('1000')
    })

    it('algosToMicroAlgosBigInt round-trips microAlgosToAlgos', () => {
        expect(algosToMicroAlgosBigInt(microAlgosToAlgos(UINT64_MAX))).toBe(
            UINT64_MAX,
        )
    })

    it('algosToMicroAlgosBigInt truncates sub-microAlgo fractions', () => {
        expect(algosToMicroAlgosBigInt('0.0000015')).toBe(1n)
    })
})
