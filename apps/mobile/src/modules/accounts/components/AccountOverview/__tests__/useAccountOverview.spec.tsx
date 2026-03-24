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
import { renderHook, act } from '@testing-library/react'
import { useAccountOverview } from '../useAccountOverview'
import { WalletAccount } from '@perawallet/wallet-core-accounts'

const { mockSetSelectedAccount, mockSetCanSelectAccount } = vi.hoisted(() => ({
    mockSetSelectedAccount: vi.fn(),
    mockSetCanSelectAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({ address: 'selected-address' })),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(() => ({
        setSelectedAccount: mockSetSelectedAccount,
        setCanSelectAccount: mockSetCanSelectAccount,
    })),
}))

describe('useAccountOverview', () => {
    const mockAccount = { address: 'test-address' } as WalletAccount

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens send funds modal when openSendFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.isSendFundsVisible).toBe(false)

        act(() => {
            result.current.openSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(true)
    })

    it('closes send funds modal when handleCloseSendFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.openSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(true)

        act(() => {
            result.current.handleCloseSendFunds()
        })

        expect(result.current.isSendFundsVisible).toBe(false)
    })

    it('opens receive funds modal and sets selected account when openReceiveFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.isReceiveFundsVisible).toBe(false)

        act(() => {
            result.current.openReceiveFunds()
        })

        expect(result.current.isReceiveFundsVisible).toBe(true)
        expect(mockSetCanSelectAccount).toHaveBeenCalledWith(false)
        expect(mockSetSelectedAccount).toHaveBeenCalledWith({
            address: 'selected-address',
        })
    })

    it('closes receive funds modal when handleCloseReceiveFunds is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.openReceiveFunds()
        })

        expect(result.current.isReceiveFundsVisible).toBe(true)

        act(() => {
            result.current.handleCloseReceiveFunds()
        })

        expect(result.current.isReceiveFundsVisible).toBe(false)
    })

    it('opens account options when openAccountOptions is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.isAccountOptionsVisible).toBe(false)

        act(() => {
            result.current.openAccountOptions()
        })

        expect(result.current.isAccountOptionsVisible).toBe(true)
    })

    it('closes account options when handleCloseAccountOptions is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.openAccountOptions()
        })

        expect(result.current.isAccountOptionsVisible).toBe(true)

        act(() => {
            result.current.handleCloseAccountOptions()
        })

        expect(result.current.isAccountOptionsVisible).toBe(false)
    })

    it('starts with scrolling enabled', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        expect(result.current.scrollingEnabled).toBe(true)
    })

    it('updates scrolling state when onScrollEnabledChange is called', () => {
        const { result } = renderHook(() => useAccountOverview(mockAccount))

        act(() => {
            result.current.onScrollEnabledChange(false)
        })

        expect(result.current.scrollingEnabled).toBe(false)

        act(() => {
            result.current.onScrollEnabledChange(true)
        })

        expect(result.current.scrollingEnabled).toBe(true)
    })
})
