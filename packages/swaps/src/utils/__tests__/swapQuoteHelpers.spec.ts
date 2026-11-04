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
import type { SwapQuote } from '../../models'
import {
    formatSwapRate,
    pickBestByAmountOut,
    sortQuotesByAmountOutDesc,
    swapRate,
} from '../swapQuoteHelpers'
import { makeSwapQuote } from '../../__tests__/swapQuoteFixture'

const quote = (id: string, amountOut?: string): SwapQuote =>
    ({
        quoteId: id,
        amountOut: amountOut === undefined ? undefined : new Decimal(amountOut),
    }) as unknown as SwapQuote

describe('pickBestByAmountOut', () => {
    it('picks the highest output and ignores quotes without one', () => {
        const best = pickBestByAmountOut([
            quote('a', '5'),
            quote('b'),
            quote('c', '9'),
            quote('d', '7'),
        ])

        expect(best?.quoteId).toBe('c')
    })

    it('returns null when no quote has an output', () => {
        expect(pickBestByAmountOut([quote('a'), quote('b')])).toBeNull()
    })
})

describe('sortQuotesByAmountOutDesc', () => {
    it('sorts descending with output-less quotes last, without mutating the input', () => {
        const input = [quote('a', '5'), quote('b'), quote('c', '9')]

        const sorted = sortQuotesByAmountOutDesc(input)

        expect(sorted.map(q => q.quoteId)).toEqual(['c', 'a', 'b'])
        expect(input.map(q => q.quoteId)).toEqual(['a', 'b', 'c'])
    })
})

describe('swapRate', () => {
    it('derives display units out per display unit in from base-unit amounts', () => {
        const rate = swapRate(
            makeSwapQuote({
                amountIn: new Decimal('5000000'),
                amountOut: new Decimal('150'),
                assetIn: { decimals: 6 },
                assetOut: { decimals: 2 },
            }),
        )

        expect(rate).toEqual(new Decimal('0.3'))
    })

    it('is null when either asset has no decimals', () => {
        expect(
            swapRate(makeSwapQuote({ assetOut: { decimals: undefined } })),
        ).toBeNull()
    })
})

describe('formatSwapRate', () => {
    it('renders the unit rate with the output asset precision', () => {
        const rate = formatSwapRate(
            makeSwapQuote({
                amountIn: new Decimal('10000000'),
                amountOut: new Decimal('3000000'),
                assetIn: { unitName: 'ALGO', decimals: 6 },
                assetOut: { unitName: 'USDC', decimals: 6 },
            }),
        )

        expect(rate).toMatch(/^1 ALGO ≈ 0\.3\d* USDC$/)
    })

    it('renders a dash when the rate is unknown', () => {
        expect(
            formatSwapRate(makeSwapQuote({ assetIn: { decimals: undefined } })),
        ).toBe('-')
    })
})
