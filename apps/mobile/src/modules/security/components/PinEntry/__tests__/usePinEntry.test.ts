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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePinEntry } from '../usePinEntry'

vi.mock('@perawallet/wallet-core-security', () => ({
    PIN_LENGTH: 4,
}))

describe('usePinEntry', () => {
    const mockOnPinComplete = vi.fn()
    const mockOnPinChange = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return initial state with empty pin', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
            }),
        )

        expect(result.current.pin).toBe('')
        expect(typeof result.current.handleKeyPress).toBe('function')
        expect(typeof result.current.clearPin).toBe('function')
    })

    it('should add digit when number key is pressed', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
                onPinChange: mockOnPinChange,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })

        expect(result.current.pin).toBe('1')
        expect(mockOnPinChange).toHaveBeenCalledWith('1')
    })

    it('should append digits when multiple keys are pressed', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
                onPinChange: mockOnPinChange,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })
        act(() => {
            result.current.handleKeyPress('2')
        })
        act(() => {
            result.current.handleKeyPress('3')
        })

        expect(result.current.pin).toBe('123')
        expect(mockOnPinChange).toHaveBeenCalledTimes(3)
    })

    it('should remove last digit when delete key is pressed', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
                onPinChange: mockOnPinChange,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })
        act(() => {
            result.current.handleKeyPress('2')
        })
        act(() => {
            result.current.handleKeyPress('delete')
        })

        expect(result.current.pin).toBe('1')
        expect(mockOnPinChange).toHaveBeenLastCalledWith('1')
    })

    it('should not add more digits than PIN_LENGTH', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })
        act(() => {
            result.current.handleKeyPress('2')
        })
        act(() => {
            result.current.handleKeyPress('3')
        })
        act(() => {
            result.current.handleKeyPress('4')
        })
        act(() => {
            result.current.handleKeyPress('5')
        })

        expect(result.current.pin).toBe('1234')
    })

    it('should call onPinComplete after delay when PIN is full', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })
        act(() => {
            result.current.handleKeyPress('2')
        })
        act(() => {
            result.current.handleKeyPress('3')
        })
        act(() => {
            result.current.handleKeyPress('4')
        })

        expect(mockOnPinComplete).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(100)
        })

        expect(mockOnPinComplete).toHaveBeenCalledWith('1234')
    })

    it('should clear pin when clearPin is called', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })
        act(() => {
            result.current.handleKeyPress('2')
        })

        expect(result.current.pin).toBe('12')

        act(() => {
            result.current.clearPin()
        })

        expect(result.current.pin).toBe('')
    })

    it('should handle delete on empty pin gracefully', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
                onPinChange: mockOnPinChange,
            }),
        )

        act(() => {
            result.current.handleKeyPress('delete')
        })

        expect(result.current.pin).toBe('')
        expect(mockOnPinChange).toHaveBeenCalledWith('')
    })

    it('should not call onPinChange if not provided', () => {
        const { result } = renderHook(() =>
            usePinEntry({
                onPinComplete: mockOnPinComplete,
            }),
        )

        act(() => {
            result.current.handleKeyPress('1')
        })

        expect(result.current.pin).toBe('1')
    })
})
