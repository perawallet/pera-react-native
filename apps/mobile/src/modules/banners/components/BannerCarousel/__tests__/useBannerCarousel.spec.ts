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

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { LayoutChangeEvent, NativeScrollEvent } from 'react-native'
import { useBannerCarousel } from '../useBannerCarousel'

const layoutEvent = (width: number, height: number) =>
    ({
        nativeEvent: { layout: { x: 0, y: 0, width, height } },
    }) as LayoutChangeEvent

const scrollEvent = (offsetX: number, viewportWidth: number) =>
    ({
        nativeEvent: {
            contentOffset: { x: offsetX, y: 0 },
            layoutMeasurement: { width: viewportWidth, height: 0 },
        } as NativeScrollEvent,
    }) as Parameters<
        ReturnType<typeof useBannerCarousel>['handleMomentumScrollEnd']
    >[0]

describe('useBannerCarousel', () => {
    it('starts on the requested banner and reports no page size until measured', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 2, count: 3 }),
        )

        expect(result.current.activeIndex).toBe(2)
        expect(result.current.pageSize).toEqual({ width: 0, height: 0 })
    })

    it('records both dimensions on layout', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 0, count: 2 }),
        )

        act(() => result.current.handleLayout(layoutEvent(402, 816)))

        expect(result.current.pageSize).toEqual({ width: 402, height: 816 })
    })

    it('keeps the same pageSize reference when a layout pass reports no change', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 0, count: 2 }),
        )

        act(() => result.current.handleLayout(layoutEvent(402, 816)))
        const first = result.current.pageSize

        act(() => result.current.handleLayout(layoutEvent(402, 816)))

        expect(result.current.pageSize).toBe(first)
    })

    it('derives the active index from the settled scroll offset', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 0, count: 3 }),
        )

        act(() => result.current.handleMomentumScrollEnd(scrollEvent(804, 402)))

        expect(result.current.activeIndex).toBe(2)
    })

    it('rounds a partial offset to the nearest page', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 0, count: 3 }),
        )

        act(() => result.current.handleMomentumScrollEnd(scrollEvent(590, 402)))

        expect(result.current.activeIndex).toBe(1)
    })

    it('ignores a scroll event reporting a zero-width viewport', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 1, count: 3 }),
        )

        act(() => result.current.handleMomentumScrollEnd(scrollEvent(0, 0)))

        expect(result.current.activeIndex).toBe(1)
    })

    it('clamps the active index when the banner list shrinks underneath it', () => {
        const { result, rerender } = renderHook(
            ({ count }: { count: number }) =>
                useBannerCarousel({ initialIndex: 0, count }),
            { initialProps: { count: 3 } },
        )

        act(() => result.current.handleMomentumScrollEnd(scrollEvent(804, 402)))
        expect(result.current.activeIndex).toBe(2)

        rerender({ count: 2 })

        expect(result.current.activeIndex).toBe(1)
    })

    it('reports index 0 when every banner is gone', () => {
        const { result } = renderHook(() =>
            useBannerCarousel({ initialIndex: 0, count: 0 }),
        )

        expect(result.current.activeIndex).toBe(0)
    })
})
