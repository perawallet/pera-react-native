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
            const { result } = renderHook(() => usePreferredCurrencyPriceQueryKeys())
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
