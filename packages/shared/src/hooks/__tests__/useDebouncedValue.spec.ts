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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useDebouncedValue } from '../useDebouncedValue'

describe('useDebouncedValue', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('returns the initial value synchronously', () => {
        const { result } = renderHook(() => useDebouncedValue('initial', 100))
        expect(result.current).toBe('initial')
    })

    test('delays propagation of the value until the delay elapses', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 200),
            { initialProps: { value: 'a' } },
        )

        rerender({ value: 'b' })
        expect(result.current).toBe('a')

        act(() => {
            vi.advanceTimersByTime(199)
        })
        expect(result.current).toBe('a')

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(result.current).toBe('b')
    })

    test('resets the timer when the value changes again mid-delay', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 200),
            { initialProps: { value: 'a' } },
        )

        rerender({ value: 'b' })
        act(() => {
            vi.advanceTimersByTime(150)
        })
        rerender({ value: 'c' })
        act(() => {
            vi.advanceTimersByTime(150)
        })
        expect(result.current).toBe('a')

        act(() => {
            vi.advanceTimersByTime(50)
        })
        expect(result.current).toBe('c')
    })

    test('uses the default delay of 300ms when no delay is given', () => {
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value),
            { initialProps: { value: 'a' } },
        )

        rerender({ value: 'b' })
        act(() => {
            vi.advanceTimersByTime(299)
        })
        expect(result.current).toBe('a')

        act(() => {
            vi.advanceTimersByTime(1)
        })
        expect(result.current).toBe('b')
    })

    test('skips the debounce entirely when isEqual returns true', () => {
        const isEqual = (a: { id: number }, b: { id: number }) => a.id === b.id
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 200, isEqual),
            { initialProps: { value: { id: 1 } } },
        )

        rerender({ value: { id: 1 } })
        act(() => {
            vi.advanceTimersByTime(1000)
        })
        // The isEqual short-circuit means the timer is never scheduled,
        // so debouncedValue stays at the initial reference.
        expect(result.current).toEqual({ id: 1 })
    })

    test('still debounces when isEqual returns false', () => {
        const isEqual = (a: { id: number }, b: { id: number }) => a.id === b.id
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value, 200, isEqual),
            { initialProps: { value: { id: 1 } } },
        )

        rerender({ value: { id: 2 } })
        expect(result.current).toEqual({ id: 1 })

        act(() => {
            vi.advanceTimersByTime(200)
        })
        expect(result.current).toEqual({ id: 2 })
    })
})
