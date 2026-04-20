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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAccountBalancesInvalidator } from '../useAccountBalancesInvalidator'
import { getInvalidateAccountBalancesPredicate } from '../querykeys'

const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))

describe('useAccountBalancesInvalidator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('invalidates queries using the account balances predicate', () => {
        const { result } = renderHook(() => useAccountBalancesInvalidator())

        result.current.invalidate()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            predicate: getInvalidateAccountBalancesPredicate,
        })
    })

    it('can be called multiple times', () => {
        const { result } = renderHook(() => useAccountBalancesInvalidator())

        result.current.invalidate()
        result.current.invalidate()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(2)
    })
})
