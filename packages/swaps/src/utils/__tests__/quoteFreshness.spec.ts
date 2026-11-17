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
    isQuoteFresh,
    pickRefreshedQuote,
    SWAP_QUOTE_TTL_MS,
} from '../quoteFreshness'

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { SwapQuote } from '../../models'
import { makeSwapQuote } from '../../__tests__/swapQuoteFixture'

const quote = (
    fetchedAt?: number,
    expiresAt: Nullable<number> = null,
): SwapQuote => ({ fetchedAt, expiresAt }) as SwapQuote

describe('isQuoteFresh', () => {
    it('accepts a quote younger than the TTL', () => {
        expect(isQuoteFresh(quote(10_000), 10_000 + SWAP_QUOTE_TTL_MS)).toBe(
            true,
        )
    })

    it('rejects a quote older than the TTL', () => {
        expect(
            isQuoteFresh(quote(10_000), 10_000 + SWAP_QUOTE_TTL_MS + 1),
        ).toBe(false)
    })

    it('rejects a quote that was never stamped', () => {
        // A quote without fetchedAt predates the freshness contract — treat
        // it as stale so it can never slip past the confirm-time guard.
        expect(isQuoteFresh(quote(undefined), 10_000)).toBe(false)
    })

    it('rejects a quote the router has already expired', () => {
        expect(isQuoteFresh(quote(10_000, 15_000), 15_000)).toBe(false)
        expect(isQuoteFresh(quote(10_000, 15_000), 14_999)).toBe(true)
    })
})

describe('pickRefreshedQuote', () => {
    const NOW = 100_000
    const confirmed = makeSwapQuote({
        provider: 'xo',
        amountOut: new Decimal('1200'),
        minimumAmountOut: new Decimal('1190'),
        fetchedAt: NOW - 50_000,
    })
    const offer = (overrides: Partial<SwapQuote> = {}) =>
        makeSwapQuote({
            quoteId: 'quote-2',
            provider: 'xo',
            amountOut: new Decimal('1200'),
            minimumAmountOut: new Decimal('1190'),
            fetchedAt: NOW,
            ...overrides,
        })

    it('takes a same-provider fresh offer whose floor equals the confirmed floor', () => {
        const picked = pickRefreshedQuote(confirmed, [offer()], NOW)

        expect(picked?.quoteId).toBe('quote-2')
    })

    it('takes an offer whose floor beats the confirmed floor', () => {
        const better = offer({ minimumAmountOut: new Decimal('1195') })

        expect(pickRefreshedQuote(confirmed, [better], NOW)).toBe(better)
    })

    it('skips another provider and a stale offer', () => {
        const other = offer({ provider: 'tinyman' })
        const stale = offer({ fetchedAt: NOW - SWAP_QUOTE_TTL_MS - 1 })

        expect(pickRefreshedQuote(confirmed, [other, stale], NOW)).toBeNull()
    })

    it('rejects a floor below the confirmed one even when the amount out is higher', () => {
        const lowFloor = offer({
            amountOut: new Decimal('1300'),
            minimumAmountOut: new Decimal('1189'),
        })

        expect(pickRefreshedQuote(confirmed, [lowFloor], NOW)).toBeNull()
    })

    it('uses the amount out as the floor when there is no minimum', () => {
        const noMinimum = makeSwapQuote({
            provider: 'xo',
            amountOut: new Decimal('1000'),
            minimumAmountOut: null,
            fetchedAt: NOW - 50_000,
        })

        expect(
            pickRefreshedQuote(
                noMinimum,
                [
                    offer({
                        amountOut: new Decimal('999'),
                        minimumAmountOut: null,
                    }),
                ],
                NOW,
            ),
        ).toBeNull()
        expect(
            pickRefreshedQuote(
                noMinimum,
                [
                    offer({
                        amountOut: new Decimal('1000'),
                        minimumAmountOut: null,
                    }),
                ],
                NOW,
            ),
        ).not.toBeNull()
        expect(
            pickRefreshedQuote(
                confirmed,
                [
                    offer({
                        amountOut: new Decimal('1191'),
                        minimumAmountOut: null,
                    }),
                ],
                NOW,
            ),
        ).not.toBeNull()
    })

    it('returns the first qualifying offer', () => {
        const first = offer({ quoteId: 'first' })
        const second = offer({ quoteId: 'second' })

        expect(pickRefreshedQuote(confirmed, [first, second], NOW)).toBe(first)
    })
})
