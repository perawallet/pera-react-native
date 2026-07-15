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
import {
    DEFAULT_MAX_FRACTION_DIGITS,
    FIAT_MAX_FRACTION_DIGITS,
    getMaxFractionDigits,
    parseCurrencyDecimalsConfig,
} from '../index'

const cryptoToken = (symbol: string) => ({ symbol, countryCode: undefined })

describe('getMaxFractionDigits', () => {
    it('returns 2 for fiat currencies (detected by countryCode)', () => {
        expect(getMaxFractionDigits({ symbol: 'USD', countryCode: 'US' })).toBe(
            FIAT_MAX_FRACTION_DIGITS,
        )
    })

    it('returns the built-in decimals for known crypto, case-insensitively', () => {
        expect(getMaxFractionDigits(cryptoToken('BTC'))).toBe(8)
        expect(getMaxFractionDigits(cryptoToken('eth'))).toBe(18)
        expect(getMaxFractionDigits(cryptoToken('SOL'))).toBe(9)
        expect(getMaxFractionDigits(cryptoToken('XRP'))).toBe(6)
    })

    it('falls back to 19 for unknown currencies and missing tokens', () => {
        expect(getMaxFractionDigits(cryptoToken('WAGMI'))).toBe(
            DEFAULT_MAX_FRACTION_DIGITS,
        )
        expect(getMaxFractionDigits(null)).toBe(DEFAULT_MAX_FRACTION_DIGITS)
    })

    it('lets overrides win over the built-in map and add new symbols', () => {
        expect(getMaxFractionDigits(cryptoToken('BTC'), { BTC: 10 })).toBe(10)
        expect(getMaxFractionDigits(cryptoToken('WAGMI'), { WAGMI: 4 })).toBe(4)
    })
})

describe('parseCurrencyDecimalsConfig', () => {
    it('parses a valid JSON map and upper-cases symbols', () => {
        expect(parseCurrencyDecimalsConfig('{"btc":8,"PEPE":4}')).toEqual({
            BTC: 8,
            PEPE: 4,
        })
    })

    it('returns an empty map for empty, malformed, or non-object input', () => {
        expect(parseCurrencyDecimalsConfig('')).toEqual({})
        expect(parseCurrencyDecimalsConfig(null)).toEqual({})
        expect(parseCurrencyDecimalsConfig('not json')).toEqual({})
        expect(parseCurrencyDecimalsConfig('[1,2,3]')).toEqual({})
    })

    it('drops entries that are not non-negative integers', () => {
        expect(
            parseCurrencyDecimalsConfig(
                '{"BTC":8,"BAD":"x","NEG":-1,"FLOAT":1.5}',
            ),
        ).toEqual({ BTC: 8 })
    })
})
