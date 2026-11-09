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

import type { RampQuote } from '../../models'
import {
    filterQuotesByPaymentMethod,
    parseRampAmount,
    pickBestQuote,
    quoteUsdPrices,
    sortQuotesByDestinationDesc,
} from '..'

const buildQuote = (
    quoteId: string,
    destinationAmount: number,
    paymentMethodId = 'CARD',
    overrides: Partial<RampQuote> = {},
): RampQuote => ({
    kind: 'meld',
    quoteId,
    provider: 'STRIPE',
    paymentMethod: { id: paymentMethodId, logo: null, name: paymentMethodId },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(destinationAmount),
    sourceValueInUsd: null,
    destinationValueInUsd: null,
    ...overrides,
})

describe('parseRampAmount', () => {
    it('parses plain decimal strings', () => {
        expect(parseRampAmount('12')?.toString()).toBe('12')
        expect(parseRampAmount('12.5')?.toString()).toBe('12.5')
        expect(parseRampAmount('.5')?.toString()).toBe('0.5')
        expect(parseRampAmount('12.')?.toString()).toBe('12')
    })

    it('returns null for empty or malformed input', () => {
        expect(parseRampAmount('')).toBeNull()
        expect(parseRampAmount('.')).toBeNull()
        expect(parseRampAmount('1.2.3')).toBeNull()
        expect(parseRampAmount('abc')).toBeNull()
        expect(parseRampAmount('1e5')).toBeNull()
        expect(parseRampAmount('-1')).toBeNull()
    })
})

describe('pickBestQuote', () => {
    it('returns null for an empty list', () => {
        expect(pickBestQuote([])).toBeNull()
    })

    it('picks the highest destination amount', () => {
        const quotes = [
            buildQuote('low', 49),
            buildQuote('high', 49.9),
            buildQuote('mid', 49.5),
        ]

        expect(pickBestQuote(quotes)?.quoteId).toBe('high')
    })
})

describe('sortQuotesByDestinationDesc', () => {
    it('sorts highest destination first without mutating the input', () => {
        const quotes = [
            buildQuote('low', 10),
            buildQuote('high', 30),
            buildQuote('mid', 20),
        ]

        const sorted = sortQuotesByDestinationDesc(quotes)

        expect(sorted.map(quote => quote.quoteId)).toEqual([
            'high',
            'mid',
            'low',
        ])
        expect(quotes[0]?.quoteId).toBe('low')
    })
})

describe('filterQuotesByPaymentMethod', () => {
    it('keeps only the quotes offering that payment method', () => {
        const quotes = [
            buildQuote('card-a', 10, 'CREDIT_DEBIT_CARD'),
            buildQuote('apple-a', 11, 'APPLE_PAY'),
            buildQuote('card-b', 12, 'CREDIT_DEBIT_CARD'),
        ]

        const filtered = filterQuotesByPaymentMethod(
            quotes,
            'CREDIT_DEBIT_CARD',
        )

        expect(filtered.map(quote => quote.quoteId)).toEqual([
            'card-a',
            'card-b',
        ])
    })

    it('returns every quote when no payment method is selected', () => {
        const quotes = [
            buildQuote('card-a', 10, 'CREDIT_DEBIT_CARD'),
            buildQuote('apple-a', 11, 'APPLE_PAY'),
        ]

        expect(filterQuotesByPaymentMethod(quotes, null)).toHaveLength(2)
    })
})

describe('quoteUsdPrices', () => {
    it('divides each USD value by its amount', () => {
        const prices = quoteUsdPrices(
            buildQuote('q', 1000, 'CARD', {
                sourceValueInUsd: new Decimal(100),
                destinationValueInUsd: new Decimal(80),
            }),
        )

        expect(prices.source?.toString()).toBe('1')
        expect(prices.destination?.toString()).toBe('0.08')
    })

    it('is null when the quote carries no USD value', () => {
        expect(quoteUsdPrices(buildQuote('q', 1000))).toEqual({
            source: null,
            destination: null,
        })
    })

    it('is null for an amount of zero instead of dividing by it', () => {
        const prices = quoteUsdPrices(
            buildQuote('q', 0, 'CARD', {
                destinationValueInUsd: new Decimal(0),
            }),
        )

        expect(prices.destination).toBeNull()
    })

    it('is null without a quote', () => {
        expect(quoteUsdPrices(null)).toEqual({
            source: null,
            destination: null,
        })
    })
})
