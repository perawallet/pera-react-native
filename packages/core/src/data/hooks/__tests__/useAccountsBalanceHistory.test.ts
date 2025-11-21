import { describe, it, expect, vi } from 'vitest'
import {
    useAccountsBalanceHistoryQueryKeys,
    useAccountsBalanceHistory,
} from '../useAccountsBalanceHistory'
import {
    useV1WalletWealthList,
    v1WalletWealthListQueryKey,
} from '../../../api/index'

// Mock the API
vi.mock('../../../api/index', () => ({
    useV1WalletWealthList: vi.fn(),
    v1WalletWealthListQueryKey: vi.fn(() => ['mockKey']),
}))

describe('useAccountsBalanceHistory', () => {
    it('re-exports useV1WalletWealthList', () => {
        expect(useAccountsBalanceHistory).toBe(useV1WalletWealthList)
    })

    describe('useAccountsBalanceHistoryQueryKeys', () => {
        it('generates correct query keys', () => {
            const params = {
                period: 'one-month' as const,
                account_addresses: ['ADDR1'],
            }

            const keys = useAccountsBalanceHistoryQueryKeys(params)

            expect(v1WalletWealthListQueryKey).toHaveBeenCalledWith(params)
            expect(keys).toEqual([['mockKey']])
        })
    })
})
