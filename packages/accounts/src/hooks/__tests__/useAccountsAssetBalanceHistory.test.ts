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
