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
import { useCurrency } from '../useCurrency'
import Decimal from 'decimal.js'
import { useCurrenciesStore } from '../../store'

// Mock the store
vi.mock('../../store', () => ({
    useCurrenciesStore: vi.fn(),
}))

// Mock the data hooks
const mockUsePreferredCurrencyPriceQuery = vi.hoisted(() => vi.fn())
vi.mock('../usePreferredCurrencyPriceQuery', () => ({
    usePreferredCurrencyPriceQuery: mockUsePreferredCurrencyPriceQuery,
}))

const mockUseAlgoUsdPriceQuery = vi.hoisted(() => vi.fn())
vi.mock('../useAlgoUsdPriceQuery', () => ({
    useAlgoUsdPriceQuery: mockUseAlgoUsdPriceQuery,
}))

describe('services/currencies/hooks', () => {
    let mockUseAppStore: any

    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAppStore = vi.mocked(useCurrenciesStore)

        mockUseAlgoUsdPriceQuery.mockReturnValue({
            data: undefined,
            isPending: false,
        })
    })

    describe('useCurrency', () => {
        it('returns preferredCurrency and setPreferredCurrency from store', () => {
            const mockPreferredCurrency = 'EUR'
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: mockPreferredCurrency,
                    setPreferredCurrency: mockSetPreferredCurrency,
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            expect(result.current.preferredCurrency).toBe(mockPreferredCurrency)
            expect(result.current.setPreferredCurrency).toBe(
                mockSetPreferredCurrency,
            )
        })

        it('calls setPreferredCurrency when updating currency', () => {
            const mockSetPreferredCurrency = vi.fn()

            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'USD',
                    setPreferredCurrency: mockSetPreferredCurrency,
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            act(() => {
                result.current.setPreferredCurrency('GBP')
            })

            expect(mockSetPreferredCurrency).toHaveBeenCalledWith('GBP')
        })

        it('returns usdToPreferred function', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'USD',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            expect(typeof result.current.usdToPreferred).toBe('function')
        })

        it('converts USD to preferred currency correctly', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('0.85') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(85))
        })

        it('returns 0 when data is pending', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('handles undefined usdPrice gracefully', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: undefined },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('handles empty usdPrice string gracefully', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'EUR',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(0))
        })

        it('converts with decimal precision', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({
                    preferredCurrency: 'JPY',
                }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('150.5') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(2.5)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(376.25))
        })

        it('returns USD amount unchanged when preferred currency is USD', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'USD' }),
            )
            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const usdAmount = Decimal(100)
            const converted = result.current.usdToPreferred(usdAmount)

            expect(converted).toEqual(Decimal(100))
        })

        it('converts USD to ALGO when preferred currency is ALGO', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseAlgoUsdPriceQuery.mockReturnValue({
                data: Decimal('0.15'),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            // $1.50 / $0.15 per ALGO = 10 ALGO
            const converted = result.current.usdToPreferred(Decimal('1.50'))
            expect(converted).toEqual(Decimal(10))
        })

        it('returns 0 when preferred is ALGO and price is pending', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseAlgoUsdPriceQuery.mockReturnValue({
                data: undefined,
                isPending: true,
            })

            const { result } = renderHook(() => useCurrency())

            const converted = result.current.usdToPreferred(Decimal(100))
            expect(converted).toEqual(Decimal(0))
        })

        it('returns 0 when preferred is ALGO and price is zero', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseAlgoUsdPriceQuery.mockReturnValue({
                data: Decimal(0),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            const converted = result.current.usdToPreferred(Decimal(100))
            expect(converted).toEqual(Decimal(0))
        })

        it('exposes algoUsdPrice from the query', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'ALGO' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: undefined,
                isPending: false,
            })

            mockUseAlgoUsdPriceQuery.mockReturnValue({
                data: Decimal('0.15'),
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            expect(result.current.algoUsdPrice).toEqual(Decimal('0.15'))
        })

        it('defaults algoUsdPrice to 0 when not loaded', () => {
            mockUseAppStore.mockImplementation((selector: any) =>
                selector({ preferredCurrency: 'USD' }),
            )

            mockUsePreferredCurrencyPriceQuery.mockReturnValue({
                data: { usdPrice: Decimal('1.0') },
                isPending: false,
            })

            const { result } = renderHook(() => useCurrency())

            expect(result.current.algoUsdPrice).toEqual(Decimal(0))
        })
    })
})
