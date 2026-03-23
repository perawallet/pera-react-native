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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useActiveAccountBalanceInvalidator } from '../useActiveAccountBalanceInvalidator'

const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

let mockSelectedAddress: string | null = 'ABC123'
vi.mock('../useSelectedAccountAddress', () => ({
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mockSelectedAddress,
        setSelectedAccountAddress: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

describe('useActiveAccountBalanceInvalidator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSelectedAddress = 'ABC123'
    })

    it('invalidates the active account balance query', () => {
        const { result } = renderHook(() =>
            useActiveAccountBalanceInvalidator(),
        )

        result.current.invalidateActiveAccount()

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: [
                'accounts',
                'balance',
                { address: 'ABC123', network: 'mainnet' },
            ],
        })
    })

    it('does not invalidate when no account is selected', () => {
        mockSelectedAddress = null

        const { result } = renderHook(() =>
            useActiveAccountBalanceInvalidator(),
        )

        result.current.invalidateActiveAccount()

        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })
})
