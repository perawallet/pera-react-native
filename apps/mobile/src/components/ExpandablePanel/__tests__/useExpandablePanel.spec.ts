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

import { useRef } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useExpandablePanel } from '../useExpandablePanel'

const { mockWithTiming } = vi.hoisted(() => ({
    mockWithTiming: vi.fn((toValue: number) => toValue),
}))

// The global mock hands out a fresh shared value each render, which re-runs
// the animation effect on every rerender.
vi.mock('react-native-reanimated', () => ({
    Easing: { bezier: () => () => undefined },
    useSharedValue: <T>(initial: T) => useRef({ value: initial }).current,
    useAnimatedStyle: <T>(worklet: () => T) => worklet(),
    withTiming: mockWithTiming,
    runOnJS: (fn: unknown) => fn,
}))

const CONTENT_HEIGHT = 120

const layoutOf = (height: number) =>
    ({ nativeEvent: { layout: { height } } }) as LayoutChangeEvent

const renderPanel = (isExpanded: boolean) =>
    renderHook(
        ({ isExpanded }: { isExpanded: boolean }) =>
            useExpandablePanel({ isExpanded }),
        { initialProps: { isExpanded } },
    )

describe('useExpandablePanel', () => {
    beforeEach(() => {
        mockWithTiming.mockClear()
    })

    it('opens a panel mounted expanded to its content without animating', () => {
        const { result, rerender } = renderPanel(true)

        act(() => result.current.onLayout(layoutOf(CONTENT_HEIGHT)))
        rerender({ isExpanded: true })

        expect(result.current.collapsableStyle).toEqual({
            height: CONTENT_HEIGHT,
            opacity: 1,
        })
        expect(mockWithTiming).not.toHaveBeenCalled()
    })

    it('animates open once toggled', () => {
        const { result, rerender } = renderPanel(false)
        act(() => result.current.onLayout(layoutOf(CONTENT_HEIGHT)))

        rerender({ isExpanded: true })

        expect(mockWithTiming).toHaveBeenCalledWith(
            CONTENT_HEIGHT,
            expect.anything(),
            expect.anything(),
        )
    })

    it('animates shut when a panel mounted expanded is collapsed', () => {
        const { result, rerender } = renderPanel(true)
        act(() => result.current.onLayout(layoutOf(CONTENT_HEIGHT)))

        rerender({ isExpanded: false })

        expect(mockWithTiming).toHaveBeenCalledWith(
            0,
            expect.anything(),
            expect.anything(),
        )
    })
})
