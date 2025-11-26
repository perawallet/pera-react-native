import { describe, it, expect } from 'vitest'
import { getCurrenciesQueryKeys } from '../useCurrenciesQuery'

describe('getCurrenciesQueryKeys', () => {
    it('returns correct query keys', () => {
        const keys = getCurrenciesQueryKeys('mainnet')
        expect(keys).toEqual(['v1', 'currencies', 'mainnet'])
    })
})
