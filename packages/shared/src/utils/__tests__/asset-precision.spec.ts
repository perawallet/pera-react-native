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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    resolveAssetDisplayPrecision,
    roundAssetAmountForDisplay,
} from '../asset-precision'

const round = (amount: string, decimals = 18) =>
    roundAssetAmountForDisplay(new Decimal(amount), decimals).toFixed()

describe('resolveAssetDisplayPrecision', () => {
    it('keeps an asset with up to 6 decimals at its own decimals, however large', () => {
        expect(resolveAssetDisplayPrecision(new Decimal('1.5'), 6)).toBe(6)
        expect(resolveAssetDisplayPrecision(new Decimal('12345.5'), 6)).toBe(6)
        expect(resolveAssetDisplayPrecision(new Decimal('1.5'), 2)).toBe(2)
    })

    it('caps an 18-decimal amount at 6 decimals', () => {
        expect(
            resolveAssetDisplayPrecision(new Decimal('0.001344293173'), 18),
        ).toBe(6)
    })

    it('extends a small amount to 2 significant digits', () => {
        expect(
            resolveAssetDisplayPrecision(new Decimal('0.0000085123'), 18),
        ).toBe(7)
        expect(
            resolveAssetDisplayPrecision(new Decimal('0.0000000412'), 18),
        ).toBe(9)
    })

    it('never extends past the asset decimals', () => {
        expect(resolveAssetDisplayPrecision(new Decimal('0.00000001'), 8)).toBe(
            8,
        )
    })

    it('keeps 4 decimals from 1,000 up', () => {
        expect(
            resolveAssetDisplayPrecision(new Decimal('1234.56789'), 18),
        ).toBe(4)
        expect(resolveAssetDisplayPrecision(new Decimal('-1000'), 18)).toBe(4)
    })

    it('uses 6 decimals for zero and a missing amount', () => {
        expect(resolveAssetDisplayPrecision(new Decimal(0), 18)).toBe(6)
        expect(resolveAssetDisplayPrecision(undefined, 18)).toBe(6)
    })
})

describe('roundAssetAmountForDisplay', () => {
    it('rounds down, never showing more than the amount', () => {
        expect(round('0.0013449999')).toBe('0.001344')
        expect(round('0.0000085999')).toBe('0.0000085')
        expect(round('1234.56789')).toBe('1234.5678')
    })

    it('leaves an amount within its display precision unchanged', () => {
        expect(round('1.5', 6)).toBe('1.5')
    })
})
