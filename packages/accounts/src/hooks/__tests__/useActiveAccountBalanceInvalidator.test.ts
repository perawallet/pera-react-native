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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useActiveAccountBalanceInvalidator } from '../useActiveAccountBalanceInvalidator'
import type { Nullable } from '@perawallet/wallet-core-shared'

const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

let mockSelectedAddress: Nullable<string> = 'ABC123'
vi.mock('../useSelectedAccountAddress', () => ({
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mockSelectedAddress,
        setSelectedAccountAddress: vi.fn(),
    }),
}))

let mockNetwork = 'mainnet'
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: mockNetwork }),
}))

describe('useActiveAccountBalanceInvalidator', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSelectedAddress = 'ABC123'
        mockNetwork = 'mainnet'
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

    it('uses the correct query key for testnet', () => {
        mockNetwork = 'testnet'

        const { result } = renderHook(() =>
            useActiveAccountBalanceInvalidator(),
        )

        result.current.invalidateActiveAccount()

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: [
                'accounts',
                'balance',
                { address: 'ABC123', network: 'testnet' },
            ],
        })
    })

    it('invalidates only the selected account query key', () => {
        mockSelectedAddress = 'XYZ789'

        const { result } = renderHook(() =>
            useActiveAccountBalanceInvalidator(),
        )

        result.current.invalidateActiveAccount()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(1)
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: [
                'accounts',
                'balance',
                { address: 'XYZ789', network: 'mainnet' },
            ],
        })
    })

    it('can be called multiple times', () => {
        const { result } = renderHook(() =>
            useActiveAccountBalanceInvalidator(),
        )

        result.current.invalidateActiveAccount()
        result.current.invalidateActiveAccount()
        result.current.invalidateActiveAccount()

        expect(mockInvalidateQueries).toHaveBeenCalledTimes(3)
    })
})
