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

import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useStakingDisclaimerSheet } from '../useStakingDisclaimerContent'

import type { LayoutChangeEvent, NativeScrollEvent } from 'react-native'

const layoutEvent = (height: number) =>
    ({
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height } },
    }) as LayoutChangeEvent

const scrollEvent = (
    offsetY: number,
    viewportHeight: number,
    contentHeight: number,
) =>
    ({
        nativeEvent: {
            contentOffset: { x: 0, y: offsetY },
            layoutMeasurement: { width: 320, height: viewportHeight },
            contentSize: { width: 320, height: contentHeight },
        } as NativeScrollEvent,
    }) as Parameters<
        ReturnType<typeof useStakingDisclaimerSheet>['handleScroll']
    >[0]

describe('useStakingDisclaimerSheet', () => {
    it('starts gated', () => {
        const { result } = renderHook(() => useStakingDisclaimerSheet())

        expect(result.current.isScrolledToBottom).toBe(false)
    })

    it('unlocks without a scroll when the content fits the viewport (PERA-4969)', () => {
        const { result } = renderHook(() => useStakingDisclaimerSheet())

        act(() => {
            result.current.handleLayout(layoutEvent(900))
            result.current.handleContentSizeChange(320, 600)
        })

        expect(result.current.isScrolledToBottom).toBe(true)
    })

    it('stays gated while the content overflows', () => {
        const { result } = renderHook(() => useStakingDisclaimerSheet())

        act(() => {
            result.current.handleLayout(layoutEvent(400))
            result.current.handleContentSizeChange(320, 2000)
        })

        expect(result.current.isScrolledToBottom).toBe(false)
    })

    it('needs both measurements before it can unlock', () => {
        const { result } = renderHook(() => useStakingDisclaimerSheet())

        act(() => {
            result.current.handleContentSizeChange(320, 600)
        })

        expect(result.current.isScrolledToBottom).toBe(false)
    })

    it('unlocks once an overflowing body is scrolled to the end', () => {
        const { result } = renderHook(() => useStakingDisclaimerSheet())

        act(() => {
            result.current.handleLayout(layoutEvent(400))
            result.current.handleContentSizeChange(320, 2000)
        })
        act(() => {
            result.current.handleScroll(scrollEvent(1600, 400, 2000))
        })

        expect(result.current.isScrolledToBottom).toBe(true)
    })
})
