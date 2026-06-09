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

import { renderHook, act } from '@test-utils/render'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { useCountdown } from '../useCountdown'

describe('useCountdown', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('starts at the initial value and is active', () => {
        const { result } = renderHook(() => useCountdown(60))

        expect(result.current.secondsRemaining).toBe(60)
        expect(result.current.isActive).toBe(true)
    })

    it('ticks down one second at a time', () => {
        const { result } = renderHook(() => useCountdown(60))

        act(() => {
            vi.advanceTimersByTime(3000)
        })

        expect(result.current.secondsRemaining).toBe(57)
        expect(result.current.isActive).toBe(true)
    })

    it('stops at zero and stays there', () => {
        const { result } = renderHook(() => useCountdown(3))

        act(() => {
            vi.advanceTimersByTime(10_000)
        })

        expect(result.current.secondsRemaining).toBe(0)
        expect(result.current.isActive).toBe(false)
    })

    it('restarts from the initial value by default', () => {
        const { result } = renderHook(() => useCountdown(5))

        act(() => {
            vi.advanceTimersByTime(5000)
        })
        expect(result.current.secondsRemaining).toBe(0)

        act(() => {
            result.current.restart()
        })
        expect(result.current.secondsRemaining).toBe(5)
        expect(result.current.isActive).toBe(true)
    })

    it('restarts from an explicit value', () => {
        const { result } = renderHook(() => useCountdown(5))

        act(() => {
            result.current.restart(30)
        })

        expect(result.current.secondsRemaining).toBe(30)
    })
})
