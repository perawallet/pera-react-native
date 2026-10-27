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
import { valueAccountTotals } from '../valueAccountTotals'

const totals = (
    nativeAmount: Decimal.Value,
    nativeUsdPrice: Decimal.Value | null,
    nonNativeUsdValue: Decimal.Value = 0,
) => ({
    nativeAmount: new Decimal(nativeAmount),
    nativeUsdPrice:
        nativeUsdPrice === null ? null : new Decimal(nativeUsdPrice),
    nonNativeUsdValue: new Decimal(nonNativeUsdValue),
    holdingsCount: 2,
    missingMetadataCount: 0,
})

describe('valueAccountTotals', () => {
    it('values a native balance with 18 decimals of precision at its price', () => {
        // 1.5 whole units at $2000, plus $12 of other holdings.
        const valued = valueAccountTotals(totals('1.5', 2000, 12), true)

        expect(valued.nativeAmount).toEqual(new Decimal('1.5'))
        expect(valued.fiatValue).toEqual(new Decimal(3012))
        expect(valued.usdValue).toEqual(new Decimal(3012))
        expect(valued.nativeValue).toEqual(new Decimal('1.506'))
    })

    it('leaves usd and fiat unknown for an unpriced native balance on a priced chain', () => {
        const valued = valueAccountTotals(totals(7, null, 30), true)

        expect(valued.usdValue).toBeNull()
        expect(valued.fiatValue).toBeNull()
        expect(valued.nativeValue).toEqual(new Decimal(7))
    })

    it('keeps usd known, and only fiat unknown, on a chain with no price source', () => {
        const valued = valueAccountTotals(totals(7, null, 30), false)

        expect(valued.usdValue).toEqual(new Decimal(30))
        expect(valued.fiatValue).toBeNull()
    })

    it('never reports a zero native balance as unknown', () => {
        const valued = valueAccountTotals(totals(0, null, 30), true)

        expect(valued.usdValue).toEqual(new Decimal(30))
        expect(valued.fiatValue).toEqual(new Decimal(30))
    })

    it('treats a native price of exactly zero as a price, not a missing one', () => {
        const valued = valueAccountTotals(totals(7, 0, 30), false)

        expect(valued.fiatValue).toEqual(new Decimal(30))
        expect(valued.nativeValue).toEqual(new Decimal(7))
    })

    it('prices only what has a price, counting an unpriced native balance as 0', () => {
        const priced = valueAccountTotals(totals('1.5', 2000, 12), true)
        const unpriced = valueAccountTotals(totals(7, null, 30), true)

        expect(priced.pricedFiatValue).toEqual(priced.fiatValue)
        expect(unpriced.fiatValue).toBeNull()
        expect(unpriced.pricedFiatValue).toEqual(new Decimal(30))
    })

    it('values nothing before the first read', () => {
        const valued = valueAccountTotals(undefined, true)

        expect(valued.nativeAmount).toEqual(new Decimal(0))
        expect(valued.nativeValue).toEqual(new Decimal(0))
        expect(valued.usdValue).toEqual(new Decimal(0))
        expect(valued.fiatValue).toEqual(new Decimal(0))
    })
})
