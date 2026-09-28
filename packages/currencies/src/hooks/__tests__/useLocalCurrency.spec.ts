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

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useLocalCurrency } from '../useLocalCurrency'

const mockUseCurrency = vi.hoisted(() => vi.fn())
vi.mock('../useCurrency', () => ({
    useCurrency: mockUseCurrency,
}))

const mockUseCurrenciesQuery = vi.hoisted(() => vi.fn())
vi.mock('../useCurrenciesQuery', () => ({
    useCurrenciesQuery: mockUseCurrenciesQuery,
}))

const mockUsePreferredCurrencyPriceQuery = vi.hoisted(() => vi.fn())
vi.mock('../usePreferredCurrencyPriceQuery', () => ({
    usePreferredCurrencyPriceQuery: mockUsePreferredCurrencyPriceQuery,
}))

describe('useLocalCurrency', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'EUR',
            fallbackCurrency: 'USD',
            usdToPreferred: (usd: Decimal) => usd.mul(new Decimal('0.9')),
        })
        mockUseCurrenciesQuery.mockReturnValue({
            data: [
                { id: 'EUR', name: 'Euro', symbol: '€' },
                { id: 'USD', name: 'US Dollar', symbol: '$' },
            ],
        })
        mockUsePreferredCurrencyPriceQuery.mockReturnValue({ data: undefined })
    })

    it('uses the preferred fiat with the usdToPreferred rate', () => {
        const { result } = renderHook(() => useLocalCurrency())

        expect(result.current.localCurrency).toBe('EUR')
        expect(result.current.localCurrencySymbol).toBe('€')
        expect(result.current.localRate?.toString()).toBe('0.9')
    })

    it('falls back to the fallback fiat and its rate when ALGO is preferred', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'USD',
            usdToPreferred: (usd: Decimal) => usd,
        })
        mockUsePreferredCurrencyPriceQuery.mockReturnValue({
            data: { id: 'USD', usdPrice: new Decimal(1) },
        })

        const { result } = renderHook(() => useLocalCurrency())

        expect(result.current.localCurrency).toBe('USD')
        expect(result.current.localCurrencySymbol).toBe('$')
        expect(result.current.localRate?.toString()).toBe('1')
        expect(mockUsePreferredCurrencyPriceQuery).toHaveBeenCalledWith(
            'USD',
            true,
        )
    })

    it('returns a null rate while the fallback rate is loading', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'ALGO',
            fallbackCurrency: 'USD',
            usdToPreferred: (usd: Decimal) => usd,
        })

        const { result } = renderHook(() => useLocalCurrency())

        expect(result.current.localRate).toBeNull()
    })

    it('falls back to the currency code when no symbol is known', () => {
        mockUseCurrency.mockReturnValue({
            preferredCurrency: 'AED',
            fallbackCurrency: 'USD',
            usdToPreferred: (usd: Decimal) => usd,
        })
        mockUseCurrenciesQuery.mockReturnValue({
            data: [{ id: 'EUR', name: 'Euro', symbol: '€' }],
        })

        const { result } = renderHook(() => useLocalCurrency())

        expect(result.current.localCurrencySymbol).toBe('AED')
    })
})
