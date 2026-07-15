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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunAfterDelay } from '../useRunAfterDelay'

describe('useRunAfterDelay', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('runs the scheduled callback after the delay elapses', () => {
        const callback = vi.fn()
        const { result } = renderHook(() => useRunAfterDelay())

        act(() => {
            result.current.schedule(callback, 1000)
        })
        expect(callback).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('flush runs the callback immediately and clears the timer', () => {
        const callback = vi.fn()
        const { result } = renderHook(() => useRunAfterDelay())

        act(() => {
            result.current.schedule(callback, 1000)
            result.current.flush()
        })
        expect(callback).toHaveBeenCalledTimes(1)

        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('cancel clears the timer without running the callback', () => {
        const callback = vi.fn()
        const { result } = renderHook(() => useRunAfterDelay())

        act(() => {
            result.current.schedule(callback, 1000)
            result.current.cancel()
            vi.advanceTimersByTime(1000)
        })
        expect(callback).not.toHaveBeenCalled()
    })

    it('flush is a no-op when nothing is scheduled', () => {
        const { result } = renderHook(() => useRunAfterDelay())

        expect(() => {
            act(() => {
                result.current.flush()
            })
        }).not.toThrow()
    })

    it('scheduling again replaces the pending callback', () => {
        const first = vi.fn()
        const second = vi.fn()
        const { result } = renderHook(() => useRunAfterDelay())

        act(() => {
            result.current.schedule(first, 1000)
            result.current.schedule(second, 1000)
            vi.advanceTimersByTime(1000)
        })
        expect(first).not.toHaveBeenCalled()
        expect(second).toHaveBeenCalledTimes(1)
    })

    it('cancels the pending timer on unmount without running the callback', () => {
        const callback = vi.fn()
        const { result, unmount } = renderHook(() => useRunAfterDelay())

        act(() => {
            result.current.schedule(callback, 1000)
        })
        unmount()
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        expect(callback).not.toHaveBeenCalled()
    })
})
