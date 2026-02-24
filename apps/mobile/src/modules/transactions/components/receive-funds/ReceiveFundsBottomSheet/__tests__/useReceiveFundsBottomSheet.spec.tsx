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

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useReceiveFundsBottomSheet } from '../useReceiveFundsBottomSheet'
import { useReceiveFunds } from '@modules/transactions/hooks'

vi.mock('@modules/transactions/hooks', () => ({
    useReceiveFunds: vi.fn(),
}))

const mockAccount = {
    address: 'test-address-123',
    name: 'Test Account',
    type: 'watch' as const,
}

const mockSetSelectedAccount = vi.fn()
const mockSetCanSelectAccount = vi.fn()
const mockSetOnFinished = vi.fn()
const mockReset = vi.fn()

describe('useReceiveFundsBottomSheet', () => {
    beforeEach(() => {
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
        const mockOnClose = vi.fn()

        const { result } = renderHook(() =>
            useReceiveFundsBottomSheet(true, undefined, mockOnClose),
        )

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

        const mockOnClose = vi.fn()

        const { result } = renderHook(() =>
            useReceiveFundsBottomSheet(true, mockAccount, mockOnClose),
        )

        expect(result.current.hasAccount).toBe(true)
    })

    it('sets canSelectAccount to false when account is provided', () => {
        const mockOnClose = vi.fn()

        renderHook(() =>
            useReceiveFundsBottomSheet(true, mockAccount, mockOnClose),
        )

        expect(mockSetCanSelectAccount).toHaveBeenCalledWith(false)
    })

    it('sets selected account when account is provided', () => {
        const mockOnClose = vi.fn()

        renderHook(() =>
            useReceiveFundsBottomSheet(true, mockAccount, mockOnClose),
        )

        expect(mockSetSelectedAccount).toHaveBeenCalledWith(mockAccount)
    })

    it('does not set account when not visible', () => {
        const mockOnClose = vi.fn()

        renderHook(() =>
            useReceiveFundsBottomSheet(false, mockAccount, mockOnClose),
        )

        expect(mockSetSelectedAccount).not.toHaveBeenCalled()
    })

    it('sets onFinished callback when visible', () => {
        const mockOnClose = vi.fn()

        renderHook(() =>
            useReceiveFundsBottomSheet(true, undefined, mockOnClose),
        )

        expect(mockSetOnFinished).toHaveBeenCalled()
    })

    it('calls reset and onClose when finished callback is invoked', () => {
        const mockOnClose = vi.fn()
        let capturedFinishedCallback: () => void = () => {}

        mockSetOnFinished.mockImplementation((fn: () => void) => {
            capturedFinishedCallback = fn
        })

        renderHook(() =>
            useReceiveFundsBottomSheet(true, undefined, mockOnClose),
        )

        capturedFinishedCallback()

        expect(mockReset).toHaveBeenCalled()
        expect(mockOnClose).toHaveBeenCalled()
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

        const mockOnClose = vi.fn()

        renderHook(() =>
            useReceiveFundsBottomSheet(true, mockAccount, mockOnClose),
        )

        expect(mockSetSelectedAccount).not.toHaveBeenCalled()
    })
})
