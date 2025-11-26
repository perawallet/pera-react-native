import { describe, it, expect, vi } from 'vitest'
import {
    useAccountsAssetBalanceHistoryQueryKeys,
    useAccountsAssetsBalanceHistory,
} from '../useAccountsAssetBalanceHistory'
import {
    useV1AccountsAssetsBalanceHistoryList,
    v1AccountsAssetsBalanceHistoryListQueryKey,
} from '../../../api-to-be-deleted/index'

// Mock the API
vi.mock('../../../api/index', () => ({
    useV1AccountsAssetsBalanceHistoryList: vi.fn(),
    v1AccountsAssetsBalanceHistoryListQueryKey: vi.fn(() => ['mockKey']),
}))

describe('useAccountsAssetBalanceHistory', () => {
    it('re-exports useV1AccountsAssetsBalanceHistoryList', () => {
        expect(useAccountsAssetsBalanceHistory).toBe(
            useV1AccountsAssetsBalanceHistoryList,
        )
    })

    describe('useAccountsAssetBalanceHistoryQueryKeys', () => {
        it('generates correct query keys', () => {
            const accountAddress = 'ADDR1'
            const assetId = '123'
            const params = { period: 'one-month' as const }

            const keys = useAccountsAssetBalanceHistoryQueryKeys(
                accountAddress,
                assetId,
                params,
            )

            expect(
                v1AccountsAssetsBalanceHistoryListQueryKey,
            ).toHaveBeenCalledWith(
                { account_address: accountAddress, asset_id: assetId },
                params,
            )
            expect(keys).toEqual([['mockKey']])
        })
    })
})
