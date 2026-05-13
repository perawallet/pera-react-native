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
import { renderHook, act } from '@testing-library/react'
import { useSetThresholdScreen } from '../useSetThresholdScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useSetThresholdScreen', () => {
    const mockPush = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useAppNavigation as Mock).mockReturnValue({
            push: mockPush,
        })
        const store = useMultisigCreationStore.getState()
        store.resetState()
        store.addParticipant({ address: 'ADDR1' })
        store.addParticipant({ address: 'ADDR2' })
        store.addParticipant({ address: 'ADDR3' })
    })

    it('shows correct participant count', () => {
        const { result } = renderHook(() => useSetThresholdScreen())

        expect(result.current.participantCount).toBe(3)
    })

    it('increments threshold', () => {
        const { result } = renderHook(() => useSetThresholdScreen())

        act(() => {
            result.current.handleIncrement()
        })

        expect(result.current.threshold).toBe(3)
    })

    it('decrements threshold', () => {
        const { result } = renderHook(() => useSetThresholdScreen())

        act(() => {
            result.current.handleDecrement()
        })

        expect(result.current.threshold).toBe(1)
    })

    it('does not increment beyond participant count', () => {
        const { result } = renderHook(() => useSetThresholdScreen())

        act(() => {
            result.current.handleIncrement()
        })
        act(() => {
            result.current.handleIncrement()
        })

        expect(result.current.threshold).toBe(3)
    })

    it('does not decrement below 1', () => {
        const { result } = renderHook(() => useSetThresholdScreen())

        act(() => {
            result.current.handleDecrement()
        })
        act(() => {
            result.current.handleDecrement()
        })

        expect(result.current.threshold).toBe(1)
    })

    it("navigates to NameMultisig when the before-create sheet resolves with 'proceed'", async () => {
        mockRequestBottomSheet.mockResolvedValueOnce('proceed')
        const { result } = renderHook(() => useSetThresholdScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockPush).toHaveBeenCalledWith('NameMultisig')
    })

    it('does not navigate when the before-create sheet is dismissed', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSetThresholdScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockPush).not.toHaveBeenCalled()
    })

    it('requests the before-create sheet with size=auto', async () => {
        mockRequestBottomSheet.mockResolvedValueOnce(undefined)
        const { result } = renderHook(() => useSetThresholdScreen())

        await act(async () => {
            await result.current.handleContinue()
        })

        expect(mockRequestBottomSheet).toHaveBeenCalledTimes(1)
        const arg = mockRequestBottomSheet.mock.calls[0][0]
        expect(arg.options).toEqual({
            size: 'auto',
            enablePanDownToClose: true,
        })
    })
})
