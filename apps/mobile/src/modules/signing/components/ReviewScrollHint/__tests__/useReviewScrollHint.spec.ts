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

import { act, renderHook } from '@testing-library/react'
import type {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
} from 'react-native'
import { describe, expect, it, vi } from 'vitest'
import type { PWScreenScrollHandle } from '@components/core'
import { useReviewScrollHint } from '../useReviewScrollHint'

const layoutOf = (height: number) =>
    ({ nativeEvent: { layout: { height } } }) as LayoutChangeEvent
const scrollTo = (y: number) =>
    ({
        nativeEvent: { contentOffset: { y } },
    }) as NativeSyntheticEvent<NativeScrollEvent>

const measured = (viewport: number, content: number) => {
    const hook = renderHook(() => useReviewScrollHint())
    act(() => {
        hook.result.current.handleBodyLayout(layoutOf(viewport))
        hook.result.current.handleContentSizeChange(0, content)
    })
    return hook
}

describe('useReviewScrollHint', () => {
    it('shows nothing before the body is measured', () => {
        const { result } = renderHook(() => useReviewScrollHint())

        act(() => result.current.handleContentSizeChange(0, 1000))

        expect(result.current.isMoreBelow).toBe(false)
    })

    it('flags more below when the content overflows the body', () => {
        expect(measured(400, 1000).result.current.isMoreBelow).toBe(true)
    })

    it('treats an overflow within the end threshold as fully seen', () => {
        expect(measured(400, 424).result.current.isMoreBelow).toBe(false)
    })

    it('clears once the body is scrolled near the end, and returns on scrolling back up', () => {
        const { result } = measured(400, 1000)

        act(() => result.current.handleScroll(scrollTo(580)))
        expect(result.current.isMoreBelow).toBe(false)

        act(() => result.current.handleScroll(scrollTo(100)))
        expect(result.current.isMoreBelow).toBe(true)
    })

    it('scrolls the body to its end', () => {
        const { result } = renderHook(() => useReviewScrollHint())
        const scrollToEnd = vi.fn()
        result.current.scrollRef.current = {
            scrollToEnd,
        } as unknown as PWScreenScrollHandle

        result.current.handleScrollToEnd()

        expect(scrollToEnd).toHaveBeenCalledWith({ animated: true })
    })
})
