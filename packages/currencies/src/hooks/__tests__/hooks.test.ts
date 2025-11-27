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

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCurrency, useCurrencyConverter } from '../hooks'
import { useAppStore } from '../../../store'
import Decimal from 'decimal.js'

// Mock the store
vi.mock('../../../store', () => ({
    useAppStore: vi.fn(),
}))

// Mock the data hook
const mockUsePreferredCurrencyPrice = vi.hoisted(() => vi.fn())
vi.mock('../../../data', () => ({
    usePreferredCurrencyPrice: mockUsePreferredCurrencyPrice,
}))

// Mock the API hook
const mockUseV1CurrenciesRead = vi.hoisted(() => vi.fn())
vi.mock('@api/index', () => ({
    useV1CurrenciesRead: mockUseV1CurrenciesRead,
    useV1WalletWealthList: vi.fn(() => ({
        data: { results: [] },
        isPending: false,
    })),
    useV1AccountsAssetsBalanceHistoryList: vi.fn(() => ({
        data: { results: [] },
        isPending: false,
    })),
}))

describe('services/currencies/hooks', () => {
    let mockUseAppStore: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAppStore = vi.mocked(useAppStore)
    })

    describe('useCurrency', () => {
        it('returns preferredCurrency and setPreferredCurrency from store', () => {
            const mockPreferredCurrency = 'EUR'
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockReturnValue({
                preferredCurrency: mockPreferredCurrency,
                setPreferredCurrency: mockSetPreferredCurrency,
            })

            const { result } = renderHook(() => useCurrency())

            expect(result.current.preferredCurrency).toBe(mockPreferredCurrency)
            expect(result.current.setPreferredCurrency).toBe(
                mockSetPreferredCurrency,
            )
        })

        it('calls setPreferredCurrency when updating currency', () => {
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'USD',
                setPreferredCurrency: mockSetPreferredCurrency,
            })

            const { result } = renderHook(() => useCurrency())

            act(() => {
                result.current.setPreferredCurrency('GBP')
            })

            expect(mockSetPreferredCurrency).toHaveBeenCalledWith('GBP')
        })
    })

    describe('useCurrencyConverter', () => {
        it('returns usdToPreferred function', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'USD',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: '1.0' },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            expect(typeof result.current.usdToPreferred).toBe('function')
        })

        it('converts USD to preferred currency correctly', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'EUR',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: '0.85' },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(85))
        })

        it('returns 0 when data is pending', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'EUR',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('handles undefined usd_value gracefully', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'EUR',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: undefined },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('handles empty usd_value string gracefully', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'EUR',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: '' },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('converts with decimal precision', () => {
            mockUseAppStore.mockReturnValue({
                preferredCurrency: 'JPY',
            })

            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: '150.5' },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(2.5)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(376.25))
        })

        it('returns USD amount unchanged when preferred currency is USD', () => {
            mockUseAppStore.mockReturnValue({ preferredCurrency: 'USD' })
            mockUsePreferredCurrencyPrice.mockReturnValue({
                data: { usd_value: '1.0' },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrencyConverter())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(100))
        })
    })
})
