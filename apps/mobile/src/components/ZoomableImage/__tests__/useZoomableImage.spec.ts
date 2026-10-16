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
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useZoomableImage } from '../useZoomableImage'

type GestureEvent = {
    scale?: number
    translationX?: number
    translationY?: number
}
type Handlers = {
    onUpdate?: (event: GestureEvent) => void
    onEnd?: () => void
}

const { gestures } = vi.hoisted(() => ({
    gestures: {} as Record<'pinch' | 'pan' | 'tap', Handlers>,
}))

vi.mock('react-native-gesture-handler', () => {
    const builder = (kind: 'pinch' | 'pan' | 'tap') => () => {
        const handlers: Handlers = {}
        gestures[kind] = handlers
        const chain = {
            minPointers: () => chain,
            numberOfTaps: () => chain,
            onUpdate: (fn: Handlers['onUpdate']) => {
                handlers.onUpdate = fn
                return chain
            },
            onEnd: (fn: Handlers['onEnd']) => {
                handlers.onEnd = fn
                return chain
            },
        }
        return chain
    }
    return {
        Gesture: {
            Pinch: builder('pinch'),
            Pan: builder('pan'),
            Tap: builder('tap'),
            Simultaneous: (...composed: unknown[]) => composed,
        },
    }
})

vi.mock('react-native-reanimated', () => ({
    useSharedValue: <T>(initial: T) => useRef({ value: initial }).current,
    useAnimatedStyle: <T>(worklet: () => T) => worklet,
    withTiming: (toValue: number) => toValue,
}))

type Transform = [
    { translateX: number },
    { translateY: number },
    { scale: number },
]

const renderZoomable = () => {
    const { result } = renderHook(() => useZoomableImage())
    const transform = () => {
        const [{ translateX }, { translateY }, { scale }] = (
            result.current.animatedStyle as unknown as () => {
                transform: Transform
            }
        )().transform
        return { translateX, translateY, scale }
    }
    return { transform }
}

const pinch = (scale: number) => {
    act(() => {
        gestures.pinch.onUpdate?.({ scale })
        gestures.pinch.onEnd?.()
    })
}

const pan = (translationX: number, translationY: number) => {
    act(() => {
        gestures.pan.onUpdate?.({ translationX, translationY })
        gestures.pan.onEnd?.()
    })
}

const doubleTap = () => act(() => gestures.tap.onEnd?.())

describe('useZoomableImage', () => {
    it('starts unzoomed and centred', () => {
        const { transform } = renderZoomable()

        expect(transform()).toEqual({ translateX: 0, translateY: 0, scale: 1 })
    })

    it('scales with the pinch', () => {
        const { transform } = renderZoomable()

        pinch(2)

        expect(transform().scale).toBe(2)
    })

    it('compounds a second pinch on the saved scale', () => {
        const { transform } = renderZoomable()
        pinch(2)

        pinch(1.5)

        expect(transform().scale).toBe(3)
    })

    it('caps the pinch at the maximum scale', () => {
        const { transform } = renderZoomable()

        pinch(10)

        expect(transform().scale).toBe(4)
    })

    it('floors the pinch at the minimum scale', () => {
        const { transform } = renderZoomable()

        pinch(0.3)

        expect(transform().scale).toBe(1)
    })

    it('ignores panning while unzoomed', () => {
        const { transform } = renderZoomable()

        pan(40, -25)

        expect(transform()).toMatchObject({ translateX: 0, translateY: 0 })
    })

    it('pans the zoomed image and accumulates across pans', () => {
        const { transform } = renderZoomable()
        pinch(2)

        pan(40, -25)
        pan(10, 5)

        expect(transform()).toMatchObject({ translateX: 50, translateY: -20 })
    })

    it('zooms in on double tap while unzoomed', () => {
        const { transform } = renderZoomable()

        doubleTap()

        expect(transform().scale).toBe(2.5)
    })

    it('resets zoom and pan on double tap while zoomed', () => {
        const { transform } = renderZoomable()
        doubleTap()
        pan(30, 30)

        doubleTap()
        pan(30, 30)

        expect(transform()).toEqual({ translateX: 0, translateY: 0, scale: 1 })
    })
})
