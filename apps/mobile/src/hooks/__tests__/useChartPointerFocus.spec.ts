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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CHART_FOCUS_DEBOUNCE_TIME } from '@constants/ui'
import { useChartPointerFocus } from '../useChartPointerFocus'

const DATA = ['a', 'b', 'c']

const renderFocusHandler = (
    onSelectionChanged: (item: string | null) => void,
) => renderHook(() => useChartPointerFocus(DATA, onSelectionChanged)).result

describe('useChartPointerFocus', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('reports the focused item on the first pointer sample', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: 1, pointerX: 10 })

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith('b')
    })

    it('throttles a new index that lands inside the debounce window', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: 0, pointerX: 5 })
        onSelectionChanged.mockClear()

        vi.advanceTimersByTime(CHART_FOCUS_DEBOUNCE_TIME - 1)
        result.current({ pointerIndex: 1, pointerX: 10 })
        expect(onSelectionChanged).not.toHaveBeenCalled()

        vi.advanceTimersByTime(2)
        result.current({ pointerIndex: 1, pointerX: 10 })
        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith('b')
    })

    it('ignores a repeat of the index it already reported', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: 2, pointerX: 20 })
        onSelectionChanged.mockClear()

        vi.advanceTimersByTime(CHART_FOCUS_DEBOUNCE_TIME + 1)
        result.current({ pointerIndex: 2, pointerX: 20 })

        expect(onSelectionChanged).not.toHaveBeenCalled()
    })

    // gifted-charts zeroes pointerX to signal release, pointerVanishDelay
    // (150ms) after the touch ends — inside the throttle window. Throttling it
    // strands the selection and leaves the caller's pager lock engaged.
    it('reports the release even when it lands inside the debounce window', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: 1, pointerX: 10 })
        onSelectionChanged.mockClear()

        vi.advanceTimersByTime(CHART_FOCUS_DEBOUNCE_TIME - 50)
        result.current({ pointerIndex: 1, pointerX: 0 })

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith(null)
    })

    it('does not report a release when nothing was selected', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: -1, pointerX: 0 })

        expect(onSelectionChanged).not.toHaveBeenCalled()
    })

    it('reports the next touch immediately after a release', () => {
        const onSelectionChanged = vi.fn()
        const result = renderFocusHandler(onSelectionChanged)

        result.current({ pointerIndex: 1, pointerX: 10 })
        result.current({ pointerIndex: 1, pointerX: 0 })
        onSelectionChanged.mockClear()

        result.current({ pointerIndex: 1, pointerX: 10 })

        expect(onSelectionChanged).toHaveBeenCalledExactlyOnceWith('b')
    })
})
