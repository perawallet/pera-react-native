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

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(),
}))

vi.mock('@hooks/useModalState', () => ({
    useModalState: () => {
        let isOpen = false
        return {
            isOpen,
            open: vi.fn(() => {
                isOpen = true
            }),
            close: vi.fn(() => {
                isOpen = false
            }),
        }
    },
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
        store.addParticipant({ address: 'ADDR1', isLocal: true })
        store.addParticipant({ address: 'ADDR2', isLocal: false })
        store.addParticipant({ address: 'ADDR3', isLocal: false })
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
})
