import { describe, it, expect, vi } from 'vitest'
import { useCurrencies, useCurrenciesQueryKeys } from '../useCurrencies'
import { useV1CurrenciesList, v1CurrenciesListQueryKey } from '../../../api/index'

// Mock the API
vi.mock('../../../api/index', () => ({
    useV1CurrenciesList: vi.fn(),
    v1CurrenciesListQueryKey: vi.fn(() => ['currenciesList']),
}))

describe('useCurrencies', () => {
    it('calls useV1CurrenciesList with empty args', () => {
        useCurrencies()
        expect(useV1CurrenciesList).toHaveBeenCalledWith({})
    })

    describe('useCurrenciesQueryKeys', () => {
        it('returns correct query keys', () => {
            const keys = useCurrenciesQueryKeys()
            expect(keys).toEqual([['currenciesList']])
            expect(v1CurrenciesListQueryKey).toHaveBeenCalled()
        })
    })
})
