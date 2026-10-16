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

import { renderHook } from '@test-utils/render'
import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    DEFAULT_MAX_FRACTION_DIGITS,
    type RampToken,
} from '@perawallet/wallet-core-onramp'
import {
    getFiatBaseAmount,
    sanitizeAmountInput,
    useOnrampAmountSection,
} from '../useOnrampAmountSection'

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    useNativeAsset: () => ({ unitName: 'ALGO' }),
}))

vi.mock('@perawallet/wallet-core-currencies', async importOriginal => ({
    ...(await importOriginal<object>()),
    useCurrency: () => ({ preferredCurrency: 'USD' }),
}))

vi.mock('@perawallet/wallet-core-remote-config', async importOriginal => ({
    ...(await importOriginal<object>()),
    useRemoteConfig: () => ({ getStringValue: () => '' }),
}))

const usdToken: RampToken = {
    id: 'USD',
    symbol: 'USD',
    name: 'US Dollar',
    fractionDecimals: 2,
    logo: null,
    network: { id: 'fiat', name: 'Fiat', logo: null },
    priceInUsd: null,
}

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
    it('passes a positive amount through', () => {
        expect(getFiatBaseAmount(new Decimal('10.5')).toString()).toBe('10.5')
    })

    it('computes a missing or non-positive amount as zero', () => {
        expect(getFiatBaseAmount(null).isZero()).toBe(true)
        expect(getFiatBaseAmount(new Decimal(0)).isZero()).toBe(true)
        expect(getFiatBaseAmount(new Decimal(-1)).isZero()).toBe(true)
    })
})

describe('useOnrampAmountSection', () => {
    it('binds the pay text and parses it for the fiat row', () => {
        const { result } = renderHook(() =>
            useOnrampAmountSection({
                variant: 'pay',
                token: usdToken,
                amountText: '12.',
                amount: null,
            }),
        )

        expect(result.current.inputValue).toBe('12.')
        expect(result.current.fiatBaseAmount.toString()).toBe('12')
    })

    it('computes unparseable pay text as zero for the fiat row', () => {
        const { result } = renderHook(() =>
            useOnrampAmountSection({
                variant: 'pay',
                token: usdToken,
                amountText: '.',
                amount: null,
            }),
        )

        expect(result.current.fiatBaseAmount.isZero()).toBe(true)
    })

    it('formats the receive amount and feeds it to the fiat row', () => {
        const { result } = renderHook(() =>
            useOnrampAmountSection({
                variant: 'receive',
                token: usdToken,
                amountText: '',
                amount: new Decimal('10.456'),
            }),
        )

        expect(result.current.inputValue).toBe('')
        expect(result.current.receiveValue).toBe('10.46')
        expect(result.current.fiatBaseAmount.toString()).toBe('10.456')
    })

    it('forwards sanitized pay text to onAmountTextChange', () => {
        const onAmountTextChange = vi.fn()
        const { result } = renderHook(() =>
            useOnrampAmountSection({
                variant: 'pay',
                token: usdToken,
                amountText: '',
                amount: null,
                onAmountTextChange,
            }),
        )

        result.current.handleTextChange('$1,5')

        expect(onAmountTextChange).toHaveBeenCalledWith('1.5')
    })
})
