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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import React from 'react'
import { renderHook } from '@testing-library/react'
import {
    BottomSheetIdContext,
    useBottomSheetStore,
} from '@modules/bottom-sheet'
import { useReceiveFundsContent } from '../useReceiveFundsContent'
import { useReceiveFunds } from '@modules/transactions/hooks'

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

const mockAccount = {
    id: 'watch-test-account',
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

const mockSetSelectedAccount = vi.fn()
const mockSetCanSelectAccount = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BottomSheetIdContext.Provider value='sheet-1'>
        {children}
    </BottomSheetIdContext.Provider>
)

describe('useReceiveFundsContent', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        vi.clearAllMocks()
        ;(useReceiveFunds as Mock).mockReturnValue({
            canSelectAccount: true,
            setSelectedAccount: mockSetSelectedAccount,
            setCanSelectAccount: mockSetCanSelectAccount,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAccount: undefined,
        })
    })

    it('returns hasAccount false when no account and canSelectAccount is true', () => {
        const { result } = renderHook(() => useReceiveFundsContent(undefined), {
            wrapper,
        })

        expect(result.current.hasAccount).toBe(false)
    })

    it('returns hasAccount true when account is provided', () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            canSelectAccount: true,
            setSelectedAccount: mockSetSelectedAccount,
            setCanSelectAccount: mockSetCanSelectAccount,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAccount: mockAccount,
        })

        const { result } = renderHook(
            () => useReceiveFundsContent(mockAccount),
            { wrapper },
        )

        expect(result.current.hasAccount).toBe(true)
    })

    it('sets canSelectAccount to false when account is provided', () => {
        renderHook(() => useReceiveFundsContent(mockAccount), { wrapper })

        expect(mockSetCanSelectAccount).toHaveBeenCalledWith(false)
    })

    it('sets selected account when account is provided', () => {
        renderHook(() => useReceiveFundsContent(mockAccount), { wrapper })

        expect(mockSetSelectedAccount).toHaveBeenCalledWith(mockAccount)
    })

    it('sets onFinished callback', () => {
        renderHook(() => useReceiveFundsContent(undefined), { wrapper })

        expect(mockSetOnFinished).toHaveBeenCalled()
    })

    it('calls reset when finished callback is invoked', () => {
        let capturedFinishedCallback: () => void = () => {}
        mockSetOnFinished.mockImplementation((fn: () => void) => {
            capturedFinishedCallback = fn
        })

        void useBottomSheetStore
            .getState()
            .request<void>({ id: 'sheet-1', contents: null })

        renderHook(() => useReceiveFundsContent(undefined), { wrapper })

        capturedFinishedCallback()

        expect(mockReset).toHaveBeenCalled()
    })

    it('resets on teardown, not just via onFinished', () => {
        // `onFinished` is wired to the ✕ button alone, so a backdrop press or
        // any other dismissal would otherwise leave `canSelectAccount: false`
        // and the next Receive would open straight onto the previous account's
        // QR instead of the picker.
        const { unmount } = renderHook(
            () => useReceiveFundsContent(mockAccount),
            { wrapper },
        )

        expect(mockReset).not.toHaveBeenCalled()

        unmount()

        expect(mockReset).toHaveBeenCalled()
    })

    it('keeps prefill written before the sheet opened', () => {
        // AccountOverview sets the account on the store and *then* opens the
        // sheet, so the cleanup has to be teardown-only — resetting on mount
        // would wipe that prefill.
        renderHook(() => useReceiveFundsContent(mockAccount), { wrapper })

        expect(mockReset).not.toHaveBeenCalled()
    })

    it('does not update selected account if address matches', () => {
        ;(useReceiveFunds as Mock).mockReturnValue({
            canSelectAccount: false,
            setSelectedAccount: mockSetSelectedAccount,
            setCanSelectAccount: mockSetCanSelectAccount,
            setOnFinished: mockSetOnFinished,
            reset: mockReset,
            selectedAccount: mockAccount,
        })

        renderHook(() => useReceiveFundsContent(mockAccount), { wrapper })

        expect(mockSetSelectedAccount).not.toHaveBeenCalled()
    })
})
