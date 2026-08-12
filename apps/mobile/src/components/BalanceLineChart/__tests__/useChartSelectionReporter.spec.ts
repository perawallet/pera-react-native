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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CHART_FOCUS_DEBOUNCE_TIME } from '@constants/ui'
import { useChartSelectionReporter } from '../useChartSelectionReporter'

const SERIES = ['a', 'b', 'c']

const renderReporter = (onSelectionChanged: (item: string | null) => void) =>
    renderHook(() => useChartSelectionReporter(SERIES, onSelectionChanged))
        .result

describe('useChartSelectionReporter', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reports the first index immediately', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(1))

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith('b')
    })

    it('defers an index that arrives inside the throttle window', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(0))
        onSelectionChanged.mockClear()

        act(() => result.current(1))
        expect(onSelectionChanged).not.toHaveBeenCalled()
    })

    // The finger stops moving between windows: nothing further arrives to
    // flush the deferred index, so without a trailing call the header would
    // stay on the wrong date for the rest of the gesture.
    it('flushes the last deferred index once the window elapses', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(0))
        onSelectionChanged.mockClear()

        act(() => result.current(1))
        act(() => result.current(2))

        act(() => {
            vi.advanceTimersByTime(CHART_FOCUS_DEBOUNCE_TIME)
        })

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith('c')
    })

    it('reports release immediately, even mid-window', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(1))
        onSelectionChanged.mockClear()

        act(() => result.current(null))

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith(null)
    })

    it('drops a deferred index when the touch is released first', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(0))
        act(() => result.current(1))
        onSelectionChanged.mockClear()

        act(() => result.current(null))
        act(() => {
            vi.advanceTimersByTime(CHART_FOCUS_DEBOUNCE_TIME * 2)
        })

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith(null)
    })

    it('reports null for an index with no matching series item', () => {
        const onSelectionChanged = vi.fn()
        const result = renderReporter(onSelectionChanged)

        act(() => result.current(99))

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith(null)
    })
})
