/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

// Plain-JS spec (not .spec.tsx) deliberately: web-shims/ ships untyped JS —
// it's a Metro-resolution-only boundary excluded from tsc's `include` glob
// (apps/mobile/tsconfig.json only picks up **/*.ts(x)) — so this test mirrors
// that rather than fighting TypeScript for module declarations nothing else
// needs.
import React from 'react'
import { act, render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PagerView from '../react-native-pager-view'

// Captures the props react-native-pager-view's shim passes to the underlying
// ScrollView, and a scrollTo spy standing in for the real DOM-node method
// react-native-web monkey-patches onto its ScrollView ref — same
// props-capture pattern as QRCameraScanner.spec.tsx's Camera mock.
const scrollViewProps = vi.hoisted(() => ({ current: undefined }))
const scrollTo = vi.hoisted(() => vi.fn())

vi.mock('react-native', async () => {
    const actual = await vi.importActual('react-native')
    const ReactActual = await vi.importActual('react')
    return {
        ...actual,
        ScrollView: ReactActual.forwardRef((props, ref) => {
            scrollViewProps.current = props
            ReactActual.useImperativeHandle(ref, () => ({ scrollTo }))
            return ReactActual.createElement(
                'div',
                { 'data-testid': 'pager-scroll-view' },
                props.children,
            )
        }),
    }
})

const triggerLayout = width => {
    act(() => {
        scrollViewProps.current?.onLayout?.({
            nativeEvent: { layout: { width } },
        })
    })
}

const triggerScroll = x => {
    act(() => {
        scrollViewProps.current?.onScroll?.({
            nativeEvent: { contentOffset: { x } },
        })
    })
}

describe('react-native-pager-view web shim', () => {
    beforeEach(() => {
        scrollViewProps.current = undefined
        scrollTo.mockClear()
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('derives onPageSelected from onScroll once the offset settles on a page', () => {
        const onPageSelected = vi.fn()
        render(
            <PagerView onPageSelected={onPageSelected}>
                <div>Page 0</div>
                <div>Page 1</div>
                <div>Page 2</div>
            </PagerView>,
        )

        triggerLayout(300)
        triggerScroll(600)

        // Not yet — react-native-web never fires onMomentumScrollEnd, so the
        // shim must not report a page until the settle debounce elapses.
        expect(onPageSelected).not.toHaveBeenCalled()

        act(() => {
            vi.advanceTimersByTime(100)
        })

        expect(onPageSelected).toHaveBeenCalledWith({
            nativeEvent: { position: 2 },
        })
    })

    it('does not re-fire onPageSelected for the same settled page', () => {
        const onPageSelected = vi.fn()
        render(
            <PagerView onPageSelected={onPageSelected}>
                <div>Page 0</div>
                <div>Page 1</div>
            </PagerView>,
        )

        triggerLayout(300)
        triggerScroll(300)
        act(() => {
            vi.advanceTimersByTime(100)
        })
        expect(onPageSelected).toHaveBeenCalledTimes(1)

        triggerScroll(300)
        act(() => {
            vi.advanceTimersByTime(100)
        })
        expect(onPageSelected).toHaveBeenCalledTimes(1)
    })

    it('applies initialPage imperatively via scrollTo once layout width is known (contentOffset is not honored on web)', () => {
        render(
            <PagerView initialPage={2}>
                <div>Page 0</div>
                <div>Page 1</div>
                <div>Page 2</div>
            </PagerView>,
        )

        triggerLayout(300)

        expect(scrollTo).toHaveBeenCalledWith({
            x: 600,
            y: 0,
            animated: false,
        })
    })

    it('sizes every page to fill the pager frame like native PagerView', () => {
        // Native RNCViewPager lays each page out to the pager's own bounds
        // (consumers size the pager, never the pages — see OnrampScreen's
        // pager/page flex chain). On web that means the height must be pushed
        // down explicitly: the scroll content container and each page wrapper
        // are 100% of the frame, otherwise a page's flex:1 (and any vertical
        // ScrollView inside it) resolves against an auto-height wrapper,
        // grows to content, and gets clipped unscrollably by the frame
        // (PERA-4948: the Fund form's Proceed button was unreachable in the
        // 600px popup).
        const { getByText } = render(
            <PagerView>
                <div>Page 0</div>
                <div>Page 1</div>
            </PagerView>,
        )

        triggerLayout(300)

        expect(scrollViewProps.current.contentContainerStyle).toMatchObject({
            height: '100%',
        })
        const wrapper = getByText('Page 0').parentElement
        expect(wrapper.style.height).toBe('100%')
        expect(wrapper.style.width).toBe('300px')
    })

    it('exposes imperative setPage/setPageWithoutAnimation matching the native ref API', () => {
        const ref = React.createRef()
        render(
            <PagerView ref={ref}>
                <div>Page 0</div>
                <div>Page 1</div>
            </PagerView>,
        )

        triggerLayout(300)

        ref.current.setPage(1)
        expect(scrollTo).toHaveBeenLastCalledWith({
            x: 300,
            y: 0,
            animated: true,
        })

        ref.current.setPageWithoutAnimation(0)
        expect(scrollTo).toHaveBeenLastCalledWith({
            x: 0,
            y: 0,
            animated: false,
        })
    })
})
