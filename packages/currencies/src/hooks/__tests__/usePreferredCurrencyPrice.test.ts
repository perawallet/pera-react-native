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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    usePreferredCurrencyPrice,
    usePreferredCurrencyPriceQueryKeys,
} from '../usePreferredCurrencyPrice'

// Mock dependencies
const mockUseV1CurrenciesRead = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1CurrenciesRead: mockUseV1CurrenciesRead,
    v1CurrenciesReadQueryKey: vi.fn(() => ['currencyRead']),
}))

const mockUseCurrency = vi.hoisted(() => vi.fn())
vi.mock('../../../services/currencies', () => ({
    useCurrency: mockUseCurrency,
}))

describe('usePreferredCurrencyPrice', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseCurrency.mockReturnValue({ preferredCurrency: 'USD' })
    })

    describe('usePreferredCurrencyPriceQueryKeys', () => {
        it('returns correct query keys', () => {
            const { result } = renderHook(() =>
                usePreferredCurrencyPriceQueryKeys(),
            )
            expect(result.current).toEqual([['currencyRead']])
        })
    })

    describe('usePreferredCurrencyPrice hook', () => {
        it('fetches preferred currency price', () => {
            mockUseV1CurrenciesRead.mockReturnValue({
                data: { exchange_price: '1.0' },
                isPending: false,
                isLoading: false,
                error: null,
                isError: false,
                refetch: vi.fn(),
            })

            const { result } = renderHook(() => usePreferredCurrencyPrice())

            expect(result.current.data).toEqual({ exchange_price: '1.0' })
            expect(result.current.isLoading).toBe(false)
        })

        it('handles loading state', () => {
            mockUseV1CurrenciesRead.mockReturnValue({
                data: undefined,
                isPending: true,
                isLoading: true,
            })

            const { result } = renderHook(() => usePreferredCurrencyPrice())

            expect(result.current.isLoading).toBe(true)
            expect(result.current.isPending).toBe(true)
        })

        it('handles error state', () => {
            mockUseV1CurrenciesRead.mockReturnValue({
                data: undefined,
                isPending: false,
                isLoading: false,
                isError: true,
                error: new Error('Failed'),
            })

            const { result } = renderHook(() => usePreferredCurrencyPrice())

            expect(result.current.isError).toBe(true)
        })
    })
})
