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
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BANNER_REVEAL_DELAY_MS } from '@constants/ui'
import { useBannerReveal } from '../animations'

const { mockWithDelay } = vi.hoisted(() => ({
    mockWithDelay: vi.fn((_delayMs: number, toValue: number) => toValue),
}))

vi.mock('react-native-reanimated', () => ({
    Easing: {
        inOut: (fn: unknown) => fn,
        quad: () => undefined,
        bezier: () => () => undefined,
    },
    useSharedValue: <T>(initial: T) => useRef({ value: initial }).current,
    useAnimatedStyle: <T>(worklet: () => T) => worklet,
    withTiming: (toValue: number) => toValue,
    withDelay: mockWithDelay,
}))

const layoutEvent = (height: number) =>
    ({ nativeEvent: { layout: { height } } }) as LayoutChangeEvent

const styleOf = (result: { current: ReturnType<typeof useBannerReveal> }) =>
    (
        result.current.animatedStyle as unknown as () => {
            height: number
            opacity: number
        }
    )()

describe('useBannerReveal', () => {
    it('stays collapsed and unmeasured before layout', () => {
        const { result } = renderHook(() => useBannerReveal())

        expect(result.current.isMeasured).toBe(false)
        expect(result.current.progress.value).toBe(0)
        expect(styleOf(result)).toEqual({ height: 0, opacity: 0 })
    })

    it('reveals to the measured height after the reveal delay', () => {
        mockWithDelay.mockClear()
        const { result } = renderHook(() => useBannerReveal())

        act(() => result.current.onMeasureLayout(layoutEvent(120)))

        expect(result.current.isMeasured).toBe(true)
        expect(result.current.progress.value).toBe(1)
        expect(styleOf(result)).toEqual({ height: 120, opacity: 1 })
        expect(mockWithDelay).toHaveBeenCalledWith(BANNER_REVEAL_DELAY_MS, 120)
    })

    it('ignores a zero-height layout', () => {
        const { result } = renderHook(() => useBannerReveal())

        act(() => result.current.onMeasureLayout(layoutEvent(0)))

        expect(result.current.isMeasured).toBe(false)
        expect(styleOf(result).height).toBe(0)
    })

    it('keeps the first measured height when layout fires again', () => {
        const { result } = renderHook(() => useBannerReveal())
        act(() => result.current.onMeasureLayout(layoutEvent(120)))

        act(() => result.current.onMeasureLayout(layoutEvent(300)))

        expect(styleOf(result).height).toBe(120)
    })
})
