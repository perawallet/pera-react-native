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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Query } from '@tanstack/react-query'
import { useAccountHoldingsInvalidator } from '../useAccountHoldingsInvalidator'
import {
    getAccountBalancesQueryKey,
    getAccountHoldingsPageQueryKey,
    getInvalidateAccountHoldingsPredicate,
} from '../querykeys'

const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

const asQuery = (queryKey: unknown[]) => ({ queryKey }) as unknown as Query

describe('useAccountHoldingsInvalidator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('invalidates queries using the account holdings predicate', () => {
        const { result } = renderHook(() => useAccountHoldingsInvalidator())

        result.current.invalidate()

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            predicate: getInvalidateAccountHoldingsPredicate,
        })
    })

    it('matches holdings-page keys and leaves other account keys alone', () => {
        const holdings = getAccountHoldingsPageQueryKey('ADDRESS', 'mainnet')
        const balances = getAccountBalancesQueryKey('ADDRESS', 'mainnet')

        expect(getInvalidateAccountHoldingsPredicate(asQuery(holdings))).toBe(
            true,
        )
        expect(getInvalidateAccountHoldingsPredicate(asQuery(balances))).toBe(
            false,
        )
    })
})
