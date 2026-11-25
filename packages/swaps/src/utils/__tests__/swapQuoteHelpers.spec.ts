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
    quoteForAssetOut,
    quoteOutUsdPrice,
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

    it('rounds a tiny rate to six significant digits', () => {
        const rate = formatSwapRate(
            makeSwapQuote({
                amountIn: new Decimal('10434241'),
                amountOut: new Decimal('5252641435984084'),
                assetIn: { unitName: 'USDC', decimals: 6 },
                assetOut: { unitName: 'ETH', decimals: 18 },
            }),
        )

        expect(rate).toBe('1 USDC ≈ 0.000503404 ETH')
    })

    it('never rounds the integer part of a large rate', () => {
        const rate = formatSwapRate(
            makeSwapQuote({
                amountIn: new Decimal('1000000'),
                amountOut: new Decimal('95123450000'),
                assetIn: { unitName: 'ETH', decimals: 6 },
                assetOut: { unitName: 'USDC', decimals: 6 },
            }),
        )

        expect(rate).toBe('1 ETH ≈ 95,123.45 USDC')
    })

    it('renders a dash when the rate is unknown', () => {
        expect(
            formatSwapRate(makeSwapQuote({ assetIn: { decimals: undefined } })),
        ).toBe('-')
    })
})

describe('quoteForAssetOut', () => {
    const MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const

    it('returns the quote for its out asset on its network', () => {
        const swapQuote = makeSwapQuote()

        expect(quoteForAssetOut(swapQuote, MAINNET, '31566704')).toBe(swapQuote)
    })

    it.each([
        ['another asset', MAINNET, '0'],
        [
            'another network',
            { chainId: 'algorand', networkId: 'testnet' },
            '31566704',
        ],
    ] as const)('returns null for %s', (_name, scope, assetId) => {
        expect(quoteForAssetOut(makeSwapQuote(), scope, assetId)).toBeNull()
    })

    it('returns null without a quote', () => {
        expect(quoteForAssetOut(null, MAINNET, '31566704')).toBeNull()
    })
})

describe('quoteOutUsdPrice', () => {
    it('prices one display unit of the out asset from the quoted USD value', () => {
        // 1.2 USDC valued at $1.09.
        const price = quoteOutUsdPrice(makeSwapQuote())

        expect(price?.toString()).toBe(
            new Decimal('1.09').div('1.2').toString(),
        )
    })

    it.each([
        ['has no USD value', { amountOutUsdValue: null }],
        ['receives nothing', { amountOut: new Decimal(0) }],
        ['has a USD value that is not a number', { amountOutUsdValue: 'n/a' }],
    ])('leaves the price unknown when the quote %s', (_name, overrides) => {
        expect(quoteOutUsdPrice(makeSwapQuote(overrides))).toBeUndefined()
    })
})
