/*
 Copyright 2022-2025 Pera Wallet, LDA
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
    transformCurrency,
    transformCurrencyList,
    transformCurrencyToPrice,
} from '../transformers'
import type { CurrencyApiResponse } from '../schema'

const makeCurrencyResponse = (
    overrides: Partial<CurrencyApiResponse> = {},
): CurrencyApiResponse => ({
    currency_id: 'USD',
    name: 'US Dollar',
    symbol: '$',
    ...overrides,
})

describe('transformCurrency', () => {
    it('maps currency_id to id', () => {
        const result = transformCurrency(
            makeCurrencyResponse({ currency_id: 'EUR' }),
        )

        expect(result.id).toBe('EUR')
    })

    it('maps name and symbol', () => {
        const result = transformCurrency(
            makeCurrencyResponse({ name: 'Euro', symbol: '€' }),
        )

        expect(result.name).toBe('Euro')
        expect(result.symbol).toBe('€')
    })
})

describe('transformCurrencyList', () => {
    it('transforms an array of responses', () => {
        const responses = [
            makeCurrencyResponse({
                currency_id: 'USD',
                name: 'US Dollar',
                symbol: '$',
            }),
            makeCurrencyResponse({
                currency_id: 'EUR',
                name: 'Euro',
                symbol: '€',
            }),
        ]

        const result = transformCurrencyList(responses)

        expect(result).toEqual([
            { id: 'USD', name: 'US Dollar', symbol: '$' },
            { id: 'EUR', name: 'Euro', symbol: '€' },
        ])
    })

    it('returns empty array for empty input', () => {
        expect(transformCurrencyList([])).toEqual([])
    })
})

describe('transformCurrencyToPrice', () => {
    it('maps currency_id to id and parses usd_value', () => {
        const result = transformCurrencyToPrice(
            makeCurrencyResponse({ currency_id: 'EUR', usd_value: '0.85' }),
        )

        expect(result.id).toBe('EUR')
        expect(result.usdPrice).toEqual(Decimal('0.85'))
    })

    it('defaults to 0 when usd_value is null', () => {
        const result = transformCurrencyToPrice(
            makeCurrencyResponse({ usd_value: null }),
        )

        expect(result.usdPrice).toEqual(Decimal('0'))
    })

    it('defaults to 0 when usd_value is undefined', () => {
        const result = transformCurrencyToPrice(
            makeCurrencyResponse({ usd_value: undefined }),
        )

        expect(result.usdPrice).toEqual(Decimal('0'))
    })

    it('handles decimal precision', () => {
        const result = transformCurrencyToPrice(
            makeCurrencyResponse({ usd_value: '1.23456789' }),
        )

        expect(result.usdPrice.toString()).toBe('1.23456789')
    })
})
