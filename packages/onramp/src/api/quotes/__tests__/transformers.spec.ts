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

import { transformPaymentMethod, transformRampQuote } from '../transformers'
import type { RampQuoteApiResponse } from '../schema'

const buildXoQuote = (
    overrides?: Partial<RampQuoteApiResponse>,
): RampQuoteApiResponse => ({
    quote_id: 'quote-xo-1',
    payment_method: {
        id: 'crypto',
        logo: 'https://example.com/crypto.png',
        name: 'Crypto',
    },
    provider_response: {
        amount: { assetId: 'algo', value: 1.25 },
        expiry: 1718000000,
        id: 'xo-provider-1',
        max: { assetId: 'algo', value: 1000 },
        min: { assetId: 'algo', value: 10 },
        minerFee: { assetId: 'algo', value: 0.001 },
        pairId: 'pair-xo-1',
    },
    ...overrides,
})

const buildMeldQuote = (
    overrides?: Partial<RampQuoteApiResponse>,
): RampQuoteApiResponse => ({
    quote_id: 'quote-meld-1',
    payment_method: {
        id: 'card',
        logo: null,
        name: 'Credit Card',
    },
    provider_response: {
        transactionType: 'BUY',
        sourceAmount: 100,
        sourceAmountWithoutFees: 95,
        fiatAmountWithoutFees: 95,
        destinationAmountWithoutFees: 480,
        sourceCurrencyCode: 'USD',
        countryCode: 'US',
        totalFee: 5,
        networkFee: 1.5,
        transactionFee: 3.5,
        destinationAmount: 475,
        destinationCurrencyCode: 'ALGO',
        exchangeRate: 4.75,
        paymentMethodType: 'CARD',
        customerScore: { assetId: 'usd', value: 0 },
        serviceProvider: 'TRANSAK',
        institutionName: 'Transak Inc',
        lowKyc: true,
        partnerFee: null,
    },
    ...overrides,
})

describe('quotes transformers', () => {
    describe('transformPaymentMethod', () => {
        it('maps id, name and preserves null logo', () => {
            const result = transformPaymentMethod({
                id: 'card',
                logo: null,
                name: 'Credit Card',
            })

            expect(result).toEqual({
                id: 'card',
                logo: null,
                name: 'Credit Card',
            })
        })
    })

    describe('transformRampQuote (XO)', () => {
        it('detects the XO shape via minerFee/pairId', () => {
            const result = transformRampQuote(buildXoQuote())

            expect(result.kind).toBe('xo')
        })

        it('maps amount.value to a Decimal equal to the API number', () => {
            const result = transformRampQuote(buildXoQuote())

            if (result.kind !== 'xo') throw new Error('expected xo quote')
            expect(result.amount.value).toBeInstanceOf(Decimal)
            expect(result.amount.value.equals(new Decimal(1.25))).toBe(true)
            expect(result.amount.assetId).toBe('algo')
        })

        it('maps minerFee.value to a Decimal', () => {
            const result = transformRampQuote(buildXoQuote())

            if (result.kind !== 'xo') throw new Error('expected xo quote')
            expect(result.minerFee.value).toBeInstanceOf(Decimal)
            expect(result.minerFee.value.equals(new Decimal(0.001))).toBe(true)
        })

        it('maps pairId, expiry, quoteId and providerQuoteId', () => {
            const result = transformRampQuote(buildXoQuote())

            if (result.kind !== 'xo') throw new Error('expected xo quote')
            expect(result.pairId).toBe('pair-xo-1')
            expect(result.expiry).toBe(1718000000)
            expect(result.quoteId).toBe('quote-xo-1')
            expect(result.providerQuoteId).toBe('xo-provider-1')
        })

        it('maps min and max amounts to Decimal', () => {
            const result = transformRampQuote(buildXoQuote())

            if (result.kind !== 'xo') throw new Error('expected xo quote')
            expect(result.min.value.equals(new Decimal(10))).toBe(true)
            expect(result.max.value.equals(new Decimal(1000))).toBe(true)
        })

        it('maps the payment method', () => {
            const result = transformRampQuote(buildXoQuote())

            expect(result.paymentMethod).toEqual({
                id: 'crypto',
                logo: 'https://example.com/crypto.png',
                name: 'Crypto',
            })
        })
    })

    describe('transformRampQuote (Meld)', () => {
        it('detects the Meld shape via serviceProvider/sourceCurrencyCode', () => {
            const result = transformRampQuote(buildMeldQuote())

            expect(result.kind).toBe('meld')
        })

        it('maps numeric fields to Decimal instances equal to API numbers', () => {
            const result = transformRampQuote(buildMeldQuote())

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.sourceAmount).toBeInstanceOf(Decimal)
            expect(result.sourceAmount.equals(new Decimal(100))).toBe(true)
            expect(result.destinationAmount.equals(new Decimal(475))).toBe(true)
            expect(result.exchangeRate.equals(new Decimal(4.75))).toBe(true)
            expect(result.totalFee.equals(new Decimal(5))).toBe(true)
            expect(result.transactionFee.equals(new Decimal(3.5))).toBe(true)
        })

        it('maps a non-null networkFee to a Decimal', () => {
            const result = transformRampQuote(buildMeldQuote())

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.networkFee).toBeInstanceOf(Decimal)
            expect(result.networkFee?.equals(new Decimal(1.5))).toBe(true)
        })

        it('maps a null networkFee to null', () => {
            const result = transformRampQuote(
                buildMeldQuote({
                    provider_response: {
                        ...buildMeldQuote().provider_response,
                        networkFee: null,
                    } as RampQuoteApiResponse['provider_response'],
                }),
            )

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.networkFee).toBeNull()
        })

        it('preserves currency codes, provider, institution and lowKyc', () => {
            const result = transformRampQuote(buildMeldQuote())

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.sourceCurrencyCode).toBe('USD')
            expect(result.destinationCurrencyCode).toBe('ALGO')
            expect(result.serviceProvider).toBe('TRANSAK')
            expect(result.institutionName).toBe('Transak Inc')
            expect(result.paymentMethodType).toBe('CARD')
            expect(result.lowKyc).toBe(true)
        })

        it('preserves a false lowKyc', () => {
            const result = transformRampQuote(
                buildMeldQuote({
                    provider_response: {
                        ...buildMeldQuote().provider_response,
                        lowKyc: false,
                    } as RampQuoteApiResponse['provider_response'],
                }),
            )

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.lowKyc).toBe(false)
        })

        it('maps a null lowKyc to null', () => {
            const result = transformRampQuote(
                buildMeldQuote({
                    provider_response: {
                        ...buildMeldQuote().provider_response,
                        lowKyc: null,
                    } as RampQuoteApiResponse['provider_response'],
                }),
            )

            if (result.kind !== 'meld') throw new Error('expected meld quote')
            expect(result.lowKyc).toBeNull()
        })
    })
})
