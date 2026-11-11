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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

type Press = { isActive: boolean; index: number }
type Reaction = (current: Press, previous: Press | null) => void

const mocks = vi.hoisted(() => ({
    reaction: { current: null as unknown },
    report: vi.fn(),
}))

vi.mock('react-native-reanimated', () => ({
    runOnJS: (fn: (...args: unknown[]) => void) => fn,
    useAnimatedReaction: (_prepare: unknown, react: unknown) => {
        mocks.reaction.current = react
    },
}))

vi.mock('../useChartSelectionReporter', () => ({
    useChartSelectionReporter: () => mocks.report,
}))

import { useChartPressSelection } from '../useChartPressSelection'

const pressState = {} as never

const fire = (current: Press, previous: Press | null) =>
    (mocks.reaction.current as Reaction)(current, previous)

describe('useChartPressSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('ticks and reports each time the highlighted index changes while pressed', () => {
        const onHighlightChange = vi.fn()
        renderHook(() =>
            useChartPressSelection(pressState, [], vi.fn(), onHighlightChange),
        )

        fire({ isActive: true, index: 3 }, { isActive: true, index: 2 })

        expect(onHighlightChange).toHaveBeenCalledTimes(1)
        expect(mocks.report).toHaveBeenCalledWith(3)
    })

    it('ticks for the first point touched', () => {
        const onHighlightChange = vi.fn()
        renderHook(() =>
            useChartPressSelection(pressState, [], vi.fn(), onHighlightChange),
        )

        fire({ isActive: true, index: 5 }, { isActive: false, index: 0 })

        expect(onHighlightChange).toHaveBeenCalledTimes(1)
    })

    it('stays silent while the finger stays on the same point', () => {
        const onHighlightChange = vi.fn()
        renderHook(() =>
            useChartPressSelection(pressState, [], vi.fn(), onHighlightChange),
        )

        fire({ isActive: true, index: 3 }, { isActive: true, index: 3 })

        expect(onHighlightChange).not.toHaveBeenCalled()
        expect(mocks.report).not.toHaveBeenCalled()
    })

    it('reports the release without a tick', () => {
        const onHighlightChange = vi.fn()
        renderHook(() =>
            useChartPressSelection(pressState, [], vi.fn(), onHighlightChange),
        )

        fire({ isActive: false, index: 3 }, { isActive: true, index: 3 })

        expect(onHighlightChange).not.toHaveBeenCalled()
        expect(mocks.report).toHaveBeenCalledWith(null)
    })

    it('still reports the selection when no tick callback is passed', () => {
        renderHook(() => useChartPressSelection(pressState, [], vi.fn()))

        fire({ isActive: true, index: 1 }, null)

        expect(mocks.report).toHaveBeenCalledWith(1)
    })
})
