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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    resolveFiatFloor,
    resolvePrecision,
    resolveSignificantPrecision,
} from '../precision'

// Literal digit counts (not symbol-relative) so these assertions actually pin
// the policy: DEFAULT_PRECISION = 2, PREFERRED_MAX_PRECISION = 6. Asserting
// against the mocked symbol would pass under any value and verify nothing.
describe('resolvePrecision', () => {
    it('noDecimal → 0 dp for whole-unit counts', () => {
        expect(resolvePrecision('noDecimal')).toEqual({
            precision: 0,
            minPrecision: 0,
        })
    })

    it('compact → fixed 2 dp for lists and summary totals', () => {
        expect(resolvePrecision('compact')).toEqual({
            precision: 2,
            minPrecision: 2,
        })
    })

    it('compact → keeps 2 dp for a value that survives the rounding', () => {
        expect(
            resolvePrecision('compact', undefined, new Decimal('1234.5678')),
        ).toEqual({ precision: 2, minPrecision: 2 })
    })

    it('compact → extends to the first significant digit when 2 dp would read as zero', () => {
        expect(
            resolvePrecision('compact', undefined, new Decimal('0.004')),
        ).toEqual({ precision: 3, minPrecision: 2 })
        expect(
            resolvePrecision('compact', undefined, new Decimal('0.0001')),
        ).toEqual({ precision: 4, minPrecision: 2 })
    })

    it('compact → extends on sign-independent magnitude', () => {
        expect(
            resolvePrecision('compact', undefined, new Decimal('-0.004')),
        ).toEqual({ precision: 3, minPrecision: 2 })
    })

    it('compact → leaves a true zero at 2 dp', () => {
        expect(resolvePrecision('compact', undefined, new Decimal(0))).toEqual({
            precision: 2,
            minPrecision: 2,
        })
    })

    it('compact → does not extend for values that round to a visible 0.01', () => {
        expect(
            resolvePrecision('compact', undefined, new Decimal('0.005')),
        ).toEqual({ precision: 2, minPrecision: 2 })
        expect(
            resolvePrecision('compact', undefined, new Decimal('0.009')),
        ).toEqual({ precision: 2, minPrecision: 2 })
    })

    it('preferredFull → up to 6 dp for a non-fiat amount, trimming trailing zeros down to 2', () => {
        expect(resolvePrecision('preferredFull')).toEqual({
            precision: 6,
            minPrecision: 2,
        })
    })

    it('preferredFull → 2 dp for a fiat amount', () => {
        expect(
            resolvePrecision(
                'preferredFull',
                undefined,
                new Decimal('1.112055'),
                true,
            ),
        ).toEqual({ precision: 2, minPrecision: 2 })
    })

    it('unitPrice → up to 6 dp, fiat or not', () => {
        const expected = { precision: 6, minPrecision: 2 }
        expect(resolvePrecision('unitPrice')).toEqual(expected)
        expect(
            resolvePrecision(
                'unitPrice',
                undefined,
                new Decimal('0.000123'),
                true,
            ),
        ).toEqual(expected)
    })

    it('assetFull → up to the asset decimals, flooring minPrecision at 2', () => {
        expect(resolvePrecision('assetFull', 6)).toEqual({
            precision: 6,
            minPrecision: 2,
            rounding: Decimal.ROUND_DOWN,
        })
    })

    it('assetFull → floors both at the asset decimals for sub-2-decimal assets', () => {
        expect(resolvePrecision('assetFull', 1)).toEqual({
            precision: 1,
            minPrecision: 1,
            rounding: Decimal.ROUND_DOWN,
        })
    })

    it('assetFull → 0 dp for 0-decimal collectibles', () => {
        expect(resolvePrecision('assetFull', 0)).toEqual({
            precision: 0,
            minPrecision: 0,
            rounding: Decimal.ROUND_DOWN,
        })
    })

    it('assetFull → caps an 18-decimal asset at 6 dp', () => {
        expect(
            resolvePrecision('assetFull', 18, new Decimal('0.001344293173')),
        ).toEqual({
            precision: 6,
            minPrecision: 2,
            rounding: Decimal.ROUND_DOWN,
        })
    })

    it('compact → follows assetFull for an asset with more than 6 decimals', () => {
        expect(
            resolvePrecision('compact', 18, new Decimal('0.001344293173')),
        ).toEqual(
            resolvePrecision('assetFull', 18, new Decimal('0.001344293173')),
        )
    })

    it('compact → keeps 2 dp for an asset with up to 6 decimals', () => {
        expect(
            resolvePrecision('compact', 6, new Decimal('1234.5678')),
        ).toEqual({ precision: 2, minPrecision: 2 })
    })

    it('assetFull → falls back to 2 dp when decimals are unknown', () => {
        expect(resolvePrecision('assetFull')).toEqual({
            precision: 2,
            minPrecision: 2,
            rounding: Decimal.ROUND_DOWN,
        })
    })

    it('significant → keeps 3 significant digits of a small amount, flooring minPrecision at 2', () => {
        expect(
            resolvePrecision('significant', 18, new Decimal('0.000008523')),
        ).toEqual({ precision: 8, minPrecision: 2 })
    })
})

describe('resolveSignificantPrecision', () => {
    it.each([
        ['0.000008523', 8],
        ['0.00001067', 7],
        ['0.0123', 4],
        ['1.5', 2],
        ['0', 2],
    ])('%s → %i dp', (value, expected) => {
        expect(resolveSignificantPrecision(new Decimal(value), 18)).toBe(
            expected,
        )
    })

    it('uses 2 dp for an unknown value', () => {
        expect(resolveSignificantPrecision(null, 18)).toBe(2)
    })

    it("never goes past the asset's decimals", () => {
        expect(resolveSignificantPrecision(new Decimal('1e-9'), 6)).toBe(6)
    })
})

describe('resolveFiatFloor', () => {
    it.each(['0.004', '0.0099'])(
        'floors a sub-cent fiat compact amount (%s) to 0.01',
        amount => {
            expect(
                resolveFiatFloor(
                    'compact',
                    true,
                    new Decimal(amount),
                )?.toString(),
            ).toBe('0.01')
        },
    )

    it.each(['-0.004', '-0.0099'])(
        'keeps the sign of a negative sub-cent fiat amount (%s), flooring it to -0.01',
        amount => {
            expect(
                resolveFiatFloor(
                    'compact',
                    true,
                    new Decimal(amount),
                )?.toString(),
            ).toBe('-0.01')
        },
    )

    it('leaves a negative amount of a cent or more to the normal rounding', () => {
        expect(
            resolveFiatFloor('compact', true, new Decimal('-0.01')),
        ).toBeNull()
    })

    it.each(['0.01', '0.025773', '0', '1234.56'])(
        'leaves %s to the normal compact rounding',
        amount => {
            expect(
                resolveFiatFloor('compact', true, new Decimal(amount)),
            ).toBeNull()
        },
    )

    it('has no floor for an unknown value', () => {
        expect(resolveFiatFloor('compact', true, null)).toBeNull()
    })

    it('keeps crypto on the extend-to-first-digit rule', () => {
        expect(
            resolveFiatFloor('compact', false, new Decimal('0.004')),
        ).toBeNull()
    })

    it('floors a sub-cent fiat detail amount to 0.01', () => {
        expect(
            resolveFiatFloor(
                'preferredFull',
                true,
                new Decimal('0.004'),
            )?.toString(),
        ).toBe('0.01')
    })

    it('leaves a unit price at its own precision', () => {
        expect(
            resolveFiatFloor('unitPrice', true, new Decimal('0.000012')),
        ).toBeNull()
    })
})
