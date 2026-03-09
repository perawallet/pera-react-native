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
import { useCreateMultisigScreen } from '../useCreateMultisigScreen'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useMultisigCreationStore } from '../../../hooks/useMultisigCreation'

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: vi.fn(() => ({
        isOpen: false,
        open: vi.fn(),
        close: vi.fn(),
    })),
}))

describe('useCreateMultisigScreen', () => {
    const mockPush = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useAppNavigation as Mock).mockReturnValue({
            push: mockPush,
        })
        useMultisigCreationStore.getState().resetState()
    })

    it('starts with no participants and continue disabled', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        expect(result.current.participants).toEqual([])
        expect(result.current.canContinue).toBe(false)
    })

    it('adds an address as participant', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleAddAddress('ADDR1')
        })

        expect(result.current.participants).toHaveLength(1)
        expect(result.current.canContinue).toBe(false)
    })

    it('enables continue with 2 or more participants', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleAddAddress('ADDR1')
        })

        act(() => {
            result.current.handleAddAddress('ADDR2')
        })

        expect(result.current.participants).toHaveLength(2)
        expect(result.current.canContinue).toBe(true)
    })

    it('ignores duplicate addresses', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleAddAddress('ADDR1')
        })

        act(() => {
            result.current.handleAddAddress('ADDR1')
        })

        expect(result.current.participants).toHaveLength(1)
    })

    it('removes a participant', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleAddAddress('ADDR1')
            result.current.handleAddAddress('ADDR2')
        })

        act(() => {
            result.current.handleRemoveParticipant('ADDR1')
        })

        expect(result.current.participants).toHaveLength(1)
        expect(result.current.participants[0].address).toBe('ADDR2')
    })

    it('navigates to SetThreshold on continue', () => {
        const { result } = renderHook(() => useCreateMultisigScreen())

        act(() => {
            result.current.handleContinue()
        })

        expect(mockPush).toHaveBeenCalledWith('SetThreshold')
    })
})
