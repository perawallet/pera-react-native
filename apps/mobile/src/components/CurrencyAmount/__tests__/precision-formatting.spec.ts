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

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { resolvePrecision, type PrecisionVariant } from '../precision'

// The global vitest.setup mock stubs formatNumber to `String(value)`, which
// ignores precision entirely — so nothing in the app suite verifies what a
// variant actually renders. Pull the REAL formatNumber via importActual and
// drive it through resolvePrecision so the precision policy is checked end to
// end against concrete output strings (this is what would catch a variant
// silently changing the decimals a user sees).
let format: (
    amount: string,
    variant: PrecisionVariant,
    decimals?: number,
) => string

beforeAll(async () => {
    const { formatNumber } = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')

    format = (amount, variant, decimals) => {
        const { precision, minPrecision } = resolvePrecision(variant, decimals)
        const { sign, integer, fraction } = formatNumber(
            new Decimal(amount),
            precision,
            'en-US',
            minPrecision,
        )
        return `${sign}${integer}${fraction}`
    }
})

describe('resolvePrecision + real formatNumber', () => {
    it('compact caps an asset balance at 2 dp (rounding, not truncating)', () => {
        expect(format('1234.5678', 'compact')).toBe('1,234.57')
    })

    it('compact pads whole and half values to 2 dp', () => {
        expect(format('5', 'compact')).toBe('5.00')
        expect(format('1.5', 'compact')).toBe('1.50')
    })

    it('assetFull keeps the asset decimals but pads down to 2', () => {
        expect(format('1.5', 'assetFull', 6)).toBe('1.50')
        expect(format('1.234567', 'assetFull', 6)).toBe('1.234567')
    })

    it('preferredFull keeps sub-cent fiat digits up to 6 dp', () => {
        expect(format('0.005', 'preferredFull')).toBe('0.005')
        expect(format('0.123456', 'preferredFull')).toBe('0.123456')
    })

    it('noDecimal renders whole units with no fraction', () => {
        expect(format('42', 'noDecimal')).toBe('42')
    })
})
