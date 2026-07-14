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

import type { MeldQuote, XoQuote } from '../../models'
import {
    parseRampAmount,
    pickBestQuote,
    quoteDestinationAmount,
    sortQuotesByDestinationDesc,
} from '..'

const buildMeldQuote = (
    quoteId: string,
    destinationAmount: number,
): MeldQuote => ({
    kind: 'meld',
    quoteId,
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    sourceAmount: new Decimal(100),
    destinationAmount: new Decimal(destinationAmount),
    sourceCurrencyCode: 'USD',
    destinationCurrencyCode: 'ALGO',
    totalFee: new Decimal(1),
    networkFee: null,
    transactionFee: new Decimal(1),
    exchangeRate: new Decimal(5),
    paymentMethodType: 'CARD',
    serviceProvider: 'STRIPE',
    institutionName: null,
    lowKyc: false,
})

const buildXoQuote = (
    quoteId: string,
    rate: number,
    minerFee: number,
): XoQuote => ({
    kind: 'xo',
    quoteId,
    paymentMethod: { id: 'CARD', logo: null, name: 'Card' },
    amount: { assetId: 'ALGO', value: new Decimal(rate) },
    min: { assetId: 'USD', value: new Decimal(10) },
    max: { assetId: 'USD', value: new Decimal(5000) },
    minerFee: { assetId: 'USDC', value: new Decimal(minerFee) },
    expiry: Date.now() + 60_000,
    pairId: 'pair-xo',
    providerQuoteId: `provider-${quoteId}`,
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

describe('quoteDestinationAmount', () => {
    it('reads the Meld destination amount straight off the quote', () => {
        const quote = buildMeldQuote('meld-1', 500)
        expect(quoteDestinationAmount(quote, '100').toString()).toBe('500')
    })

    it('computes XO as sourceAmount * rate - minerFee', () => {
        const quote = buildXoQuote('xo-1', 5, 1)
        expect(quoteDestinationAmount(quote, '10').toString()).toBe('49')
    })

    it('treats an unparseable XO source amount as zero', () => {
        const quote = buildXoQuote('xo-1', 5, 1)
        expect(quoteDestinationAmount(quote, '').toString()).toBe('-1')
        expect(quoteDestinationAmount(quote, '1.2.3').toString()).toBe('-1')
    })
})

describe('pickBestQuote', () => {
    it('returns null for an empty list', () => {
        expect(pickBestQuote([], '10')).toBeNull()
    })

    it('picks the highest fee-adjusted destination amount across kinds', () => {
        // xo-low: 10 * 5 - 1 = 49; xo-high: 10 * 5 - 0.1 = 49.9; meld: 49.5
        const quotes = [
            buildXoQuote('xo-low', 5, 1),
            buildMeldQuote('meld-1', 49.5),
            buildXoQuote('xo-high', 5, 0.1),
        ]
        expect(pickBestQuote(quotes, '10')?.quoteId).toBe('xo-high')
    })
})

describe('sortQuotesByDestinationDesc', () => {
    it('sorts highest destination first without mutating the input', () => {
        const quotes = [
            buildMeldQuote('meld-low', 10),
            buildMeldQuote('meld-high', 30),
            buildMeldQuote('meld-mid', 20),
        ]
        const sorted = sortQuotesByDestinationDesc(quotes, '100')
        expect(sorted.map(quote => quote.quoteId)).toEqual([
            'meld-high',
            'meld-mid',
            'meld-low',
        ])
        expect(quotes[0]?.quoteId).toBe('meld-low')
    })
})
