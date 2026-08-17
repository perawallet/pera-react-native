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
import { Platform } from 'react-native'
import { act, renderHook } from '@test-utils/render'
import { isSeparatorSuppressed, useSearchableList } from '../useSearchableList'
import type { PWFlatListRef } from '@components/core'

const HEADER_SENTINEL = { __searchableListHeader: true, key: 'h' }
const SEARCH_SENTINEL = { __searchableListSearch: true, key: 's' }
const ROW = { id: '1' }

describe('isSeparatorSuppressed', () => {
    it('suppresses the divider between the header and search sentinels', () => {
        expect(isSeparatorSuppressed(HEADER_SENTINEL, SEARCH_SENTINEL)).toBe(
            true,
        )
    })

    it('suppresses the divider between the search sentinel and the first row', () => {
        expect(isSeparatorSuppressed(SEARCH_SENTINEL, ROW)).toBe(true)
    })

    it('suppresses the divider when only the leading side is a sentinel', () => {
        expect(isSeparatorSuppressed(HEADER_SENTINEL, ROW)).toBe(true)
    })

    it('keeps the divider between two real rows', () => {
        expect(isSeparatorSuppressed(ROW, { id: '2' })).toBe(false)
    })
})

// User-feedback #3: on web, focusing the search input pins it to the top
// (correct, shared with native), but scrolling afterwards left it glued —
// floating over the underlying content — instead of unpinning like it does
// on native. Root cause: react-native-web's ScrollView never emits
// onScrollBeginDrag/onScrollEndDrag (ScrollViewBase only wires up
// onScroll/onTouchMove/onWheel), so handleScrollBeginDrag — the handler that
// unpins on native by exiting search mode the moment a drag starts — never
// fires on web for any input device (touch, wheel, or trackpad). Confirmed
// live in Chromium: mouse-wheel scrolling moves the real scroll container's
// scrollTop, proving onScroll does fire, while the overlay stayed focused and
// visible throughout.
describe('useSearchableList web unpin-on-scroll (user-feedback #3)', () => {
    const HEADER_HEIGHT = 320

    const setup = () => {
        const forwardedRef = {
            current: null,
        } as React.ForwardedRef<PWFlatListRef>
        return renderHook(() =>
            useSearchableList({
                forwardedRef,
                data: [{ id: '1' }, { id: '2' }],
                keyExtractor: item => item.id,
                snapThreshold: 0.25,
            }),
        )
    }

    const layoutHeader = (
        result: {
            current: Pick<
                ReturnType<typeof useSearchableList>,
                'handleHeaderLayout'
            >
        },
        height: number,
    ) =>
        act(() =>
            result.current.handleHeaderLayout({
                nativeEvent: { layout: { height } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any),
        )

    const scrollTo = (
        result: {
            current: Pick<ReturnType<typeof useSearchableList>, 'handleScroll'>
        },
        y: number,
    ) =>
        act(() =>
            result.current.handleScroll({
                nativeEvent: { contentOffset: { y } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any),
        )

    beforeEach(() => {
        Platform.OS = 'ios'
    })

    it('unpins (hides the overlay) once a real scroll moves away from the settled pin offset on web', () => {
        Platform.OS = 'web'
        const { result } = setup()
        layoutHeader(result, HEADER_HEIGHT)

        act(() => result.current.handleEnterSearch())
        expect(result.current.showOverlay).toBe(true)

        // Still converging on the pin offset (handleSearchFocus's own
        // scrollToOffset animation) — must not unpin mid-flight.
        scrollTo(result, HEADER_HEIGHT / 2)
        expect(result.current.showOverlay).toBe(true)

        // Settles exactly at the pinned offset — still showing, now armed.
        scrollTo(result, HEADER_HEIGHT)
        expect(result.current.showOverlay).toBe(true)

        // A real user scroll away from the settled pin (revealing the
        // header) — this is the wheel-scroll signal standing in for the
        // onScrollBeginDrag that never fires on web.
        scrollTo(result, 20)
        expect(result.current.showOverlay).toBe(false)
    })

    it('unpins when scrolling further down past the settled pin offset on web', () => {
        Platform.OS = 'web'
        const { result } = setup()
        layoutHeader(result, HEADER_HEIGHT)

        act(() => result.current.handleEnterSearch())
        scrollTo(result, HEADER_HEIGHT)
        expect(result.current.showOverlay).toBe(true)

        scrollTo(result, HEADER_HEIGHT + 200)
        expect(result.current.showOverlay).toBe(false)
    })

    it('does not unpin from scroll alone on native — onScrollBeginDrag remains the only trigger', () => {
        Platform.OS = 'ios'
        const { result } = setup()
        layoutHeader(result, HEADER_HEIGHT)

        act(() => result.current.handleEnterSearch())
        expect(result.current.showOverlay).toBe(true)

        scrollTo(result, HEADER_HEIGHT)
        scrollTo(result, 20)
        scrollTo(result, HEADER_HEIGHT + 200)
        expect(result.current.showOverlay).toBe(true)

        act(() => result.current.handleScrollBeginDrag())
        expect(result.current.showOverlay).toBe(false)
    })
})

// Reported on the account overview asset list: scrolling well down, then any
// content-size change (recycled cells re-measuring after a fling, a refetch
// swapping the array) jumped the list back near the top. The pin correction in
// handleContentSizeChange fired on every content-size change, and its target —
// the header height — sits near the top of the content.
describe('useSearchableList content-size pin correction', () => {
    const HEADER_HEIGHT = 320

    const setup = () => {
        const scrollToOffset = vi.fn()
        const forwardedRef = {
            current: null,
        } as React.ForwardedRef<PWFlatListRef>
        const rendered = renderHook(() =>
            useSearchableList({
                forwardedRef,
                data: [{ id: '1' }, { id: '2' }],
                keyExtractor: item => item.id,
                snapThreshold: 0.25,
            }),
        )
        // The correction drives the hook's OWN list ref (the one the component
        // attaches to FlashList), not the ref forwarded upward — asserting on
        // the latter would make every one of these tests pass vacuously.
        rendered.result.current.listRef.current = {
            scrollToOffset,
            scrollToIndex: vi.fn(),
            scrollToEnd: vi.fn(),
        }
        return { ...rendered, scrollToOffset }
    }

    // Narrowed with Pick, like the describe block above: the full result type
    // is generic in the item, so a `<{id: string}>` result is not assignable to
    // the `<unknown>` that `ReturnType` resolves to. These members don't
    // involve the item type.
    const layoutHeader = (
        result: {
            current: Pick<
                ReturnType<typeof useSearchableList>,
                'handleHeaderLayout'
            >
        },
        height: number,
    ) =>
        act(() =>
            result.current.handleHeaderLayout({
                nativeEvent: { layout: { height } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any),
        )

    const scrollTo = (
        result: {
            current: Pick<ReturnType<typeof useSearchableList>, 'handleScroll'>
        },
        y: number,
    ) =>
        act(() =>
            result.current.handleScroll({
                nativeEvent: { contentOffset: { y } },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any),
        )

    beforeEach(() => {
        Platform.OS = 'ios'
    })

    it('leaves a scroll position deep in the list alone when content size changes', () => {
        const { result, scrollToOffset } = setup()
        layoutHeader(result, HEADER_HEIGHT)

        // Past the header, so the pin is collapsed — the state the correction
        // used to fire in unconditionally.
        scrollTo(result, 5000)
        scrollToOffset.mockClear()

        act(() => result.current.handleContentSizeChange(0, 12_000))

        expect(scrollToOffset).not.toHaveBeenCalled()
    })

    // The behaviour the correction exists for, still intact.
    it('snaps back to the pin when the offset has drifted above it', () => {
        const { result, scrollToOffset } = setup()
        layoutHeader(result, HEADER_HEIGHT)

        // Collapse first, then a transient drop leaves the offset above the pin.
        scrollTo(result, 5000)
        scrollTo(result, HEADER_HEIGHT - 40)
        scrollToOffset.mockClear()

        act(() => result.current.handleContentSizeChange(0, 900))

        expect(scrollToOffset).toHaveBeenCalledWith({
            offset: HEADER_HEIGHT,
            animated: false,
        })
    })

    it('does nothing while the header is still expanded', () => {
        const { result, scrollToOffset } = setup()
        layoutHeader(result, HEADER_HEIGHT)
        scrollToOffset.mockClear()

        act(() => result.current.handleContentSizeChange(0, 900))

        expect(scrollToOffset).not.toHaveBeenCalled()
    })
})
