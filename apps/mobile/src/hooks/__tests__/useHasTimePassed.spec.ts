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

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { appStateListeners } = vi.hoisted(() => ({
    appStateListeners: [] as ((state: string) => void)[],
}))

vi.mock('react-native', async importOriginal => ({
    ...(await importOriginal<typeof import('react-native')>()),
    AppState: {
        addEventListener: (_type: string, cb: (state: string) => void) => {
            appStateListeners.push(cb)
            return { remove: vi.fn() }
        },
    },
}))

import { useHasTimePassed } from '../useHasTimePassed'

const NOW = Date.UTC(2026, 0, 1)
const DAY_MS = 24 * 60 * 60 * 1000

describe('useHasTimePassed', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })
    afterEach(() => {
        vi.useRealTimers()
        appStateListeners.length = 0
    })

    it('is false without a time', () => {
        const { result } = renderHook(() => useHasTimePassed(undefined))

        expect(result.current.hasPassed).toBe(false)
    })

    it('is true for a time already past', () => {
        const { result } = renderHook(() => useHasTimePassed(NOW - 1))

        expect(result.current.hasPassed).toBe(true)
    })

    it('flips once the time arrives', () => {
        const { result } = renderHook(() => useHasTimePassed(NOW + 1000))
        expect(result.current.hasPassed).toBe(false)

        act(() => {
            vi.advanceTimersByTime(1000)
        })

        expect(result.current.hasPassed).toBe(true)
    })

    it('waits out a time beyond the longest setTimeout delay', () => {
        const { result } = renderHook(() => useHasTimePassed(NOW + 30 * DAY_MS))

        act(() => {
            vi.advanceTimersByTime(25 * DAY_MS)
        })
        expect(result.current.hasPassed).toBe(false)

        act(() => {
            vi.advanceTimersByTime(5 * DAY_MS)
        })
        expect(result.current.hasPassed).toBe(true)
    })

    it('re-reads the clock when the app returns to the foreground', () => {
        const { result } = renderHook(() => useHasTimePassed(NOW + 1000))

        // Moves the clock without running timers, as after the device sleeps.
        vi.setSystemTime(NOW + 1000)
        act(() => {
            for (const listener of appStateListeners) listener('active')
        })

        expect(result.current.hasPassed).toBe(true)
    })

    it('flips at once when rechecked past the time', () => {
        const { result } = renderHook(() => useHasTimePassed(NOW + 1000))

        vi.setSystemTime(NOW + 1000)
        let rechecked = false
        act(() => {
            rechecked = result.current.recheck()
        })

        expect(rechecked).toBe(true)
        expect(result.current.hasPassed).toBe(true)
    })
})
