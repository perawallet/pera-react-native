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

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { LayoutChangeEvent } from 'react-native'

import {
    BANNER_REVEAL_DELAY_MS,
    BANNER_REVEAL_DURATION_MS,
} from '@constants/ui'

// The setup-wide reanimated mock collapses withDelay/withTiming to their target
// value, which throws the delay and duration away. This hook's whole job is to
// schedule those, so replace the mock locally with one that records them.
const timings: { delay: number; duration: number }[] = []

vi.mock('react-native-reanimated', () => ({
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (toValue: unknown, config: { duration: number }) => ({
        toValue,
        duration: config.duration,
    }),
    withDelay: (
        delay: number,
        animation: { toValue: unknown; duration: number },
    ) => {
        timings.push({ delay, duration: animation.duration })
        return animation.toValue
    },
    // `@constants/ui` builds easings at import time, so the whole surface it
    // touches has to exist here.
    Easing: {
        inOut: (fn: unknown) => fn,
        out: (fn: unknown) => fn,
        in: (fn: unknown) => fn,
        ease: () => undefined,
        linear: () => undefined,
        quad: () => undefined,
        cubic: () => undefined,
        bezier: () => () => undefined,
    },
}))

const { useBannerReveal } = await import('../animations')

const layoutEvent = (height: number) =>
    ({ nativeEvent: { layout: { height } } }) as LayoutChangeEvent

describe('useBannerReveal', () => {
    beforeEach(() => {
        timings.length = 0
    })

    it('reveals to the measured height once a layout arrives', () => {
        const { result } = renderHook(() => useBannerReveal())

        expect(result.current.isMeasured).toBe(false)

        act(() => result.current.onMeasureLayout(layoutEvent(64)))

        expect(result.current.isMeasured).toBe(true)
        expect(timings).toHaveLength(3)
        expect(
            timings.every(
                timing =>
                    timing.delay === BANNER_REVEAL_DELAY_MS &&
                    timing.duration === BANNER_REVEAL_DURATION_MS,
            ),
        ).toBe(true)
    })

    it('honours a caller-supplied delay and duration', () => {
        // The backup-reminder banner gates its own pre-reveal beat, so it needs
        // a zero delay and its own shorter duration.
        const { result } = renderHook(() =>
            useBannerReveal({ delayMs: 0, durationMs: 200 }),
        )

        act(() => result.current.onMeasureLayout(layoutEvent(64)))

        expect(timings).toHaveLength(3)
        expect(
            timings.every(
                timing => timing.delay === 0 && timing.duration === 200,
            ),
        ).toBe(true)
    })

    it('ignores a zero-height layout so the reveal waits for a real measure', () => {
        const { result } = renderHook(() => useBannerReveal())

        act(() => result.current.onMeasureLayout(layoutEvent(0)))

        expect(result.current.isMeasured).toBe(false)
        expect(timings).toHaveLength(0)
    })

    it('latches the first measurement against later layout passes', () => {
        const { result } = renderHook(() => useBannerReveal())

        act(() => result.current.onMeasureLayout(layoutEvent(64)))
        act(() => result.current.onMeasureLayout(layoutEvent(120)))

        // Re-measuring would restart the animation mid-reveal.
        expect(timings).toHaveLength(3)
    })
})
