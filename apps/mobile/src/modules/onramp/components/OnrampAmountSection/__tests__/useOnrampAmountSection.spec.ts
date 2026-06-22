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

import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { DEFAULT_MAX_FRACTION_DIGITS } from '@perawallet/wallet-core-onramp'
import {
    getFiatBaseAmount,
    sanitizeAmountInput,
} from '../useOnrampAmountSection'

describe('sanitizeAmountInput', () => {
    it('normalizes a comma decimal separator', () => {
        expect(sanitizeAmountInput('1,5')).toBe('1.5')
    })

    it('keeps only the first decimal separator', () => {
        expect(sanitizeAmountInput('1.2.3')).toBe('1.23')
        expect(sanitizeAmountInput('1,2,3')).toBe('1.23')
    })

    it('strips non-numeric characters from pasted input', () => {
        expect(sanitizeAmountInput('$1,234.56')).toBe('1.23456')
        expect(sanitizeAmountInput('abc')).toBe('')
        expect(sanitizeAmountInput('-10')).toBe('10')
    })

    it('passes plain decimal strings through unchanged', () => {
        expect(sanitizeAmountInput('100')).toBe('100')
        expect(sanitizeAmountInput('0.5')).toBe('0.5')
        expect(sanitizeAmountInput('12.')).toBe('12.')
    })

    it('defaults to the 19-digit fallback when no cap is given', () => {
        const fraction = '1'.repeat(DEFAULT_MAX_FRACTION_DIGITS + 5)
        expect(sanitizeAmountInput(`0.${fraction}`)).toBe(
            `0.${'1'.repeat(DEFAULT_MAX_FRACTION_DIGITS)}`,
        )
    })

    it('caps the fraction at the supplied number of places', () => {
        expect(sanitizeAmountInput('0.123456789', 2)).toBe('0.12')
        expect(sanitizeAmountInput('1.5', 0)).toBe('1.')
        // Integer digits are never truncated.
        expect(sanitizeAmountInput('123456789012345678901234567890', 2)).toBe(
            '123456789012345678901234567890',
        )
    })
})

describe('getFiatBaseAmount', () => {
    it('parses a raw pay string into a Decimal', () => {
        expect(getFiatBaseAmount('100').toString()).toBe('100')
        expect(getFiatBaseAmount('0.5').toString()).toBe('0.5')
    })

    it('passes a positive receive Decimal through', () => {
        expect(getFiatBaseAmount(new Decimal('10.5')).toString()).toBe('10.5')
    })

    it('computes empty, invalid, or non-positive amounts as zero', () => {
        expect(getFiatBaseAmount('').isZero()).toBe(true)
        expect(getFiatBaseAmount('1.2.3').isZero()).toBe(true)
        expect(getFiatBaseAmount('0').isZero()).toBe(true)
        expect(getFiatBaseAmount(new Decimal(0)).isZero()).toBe(true)
        expect(getFiatBaseAmount(new Decimal(-1)).isZero()).toBe(true)
        expect(getFiatBaseAmount(null).isZero()).toBe(true)
    })
})
