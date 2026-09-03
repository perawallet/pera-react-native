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

import {
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    Platform,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native'

import type { PWFlatListRef } from '@components/core'
import type { SearchInputRef } from '@components/SearchInput'
import type { Nullable } from '@perawallet/wallet-core-shared'

const SEARCH_KEY = '__searchable_list_search__'
const HEADER_KEY = '__searchable_list_header__'
const DEFAULT_ITEM_HEIGHT_ESTIMATE = 56
// react-native-web's ScrollView never emits onScrollBeginDrag/onScrollEndDrag
// (see ScrollViewBase — it only wires up onScroll/onTouchMove/onWheel), so the
// native unpin-on-drag path below never fires on web regardless of input
// device. Tolerance (px) for treating the settle-scroll onScroll tick — fired
// while handleSearchFocus's own scrollToOffset animation is still converging
// on headerHeightRef.current — as "arrived", vs. a real subsequent user
// scroll away from that pinned offset.
const WEB_PIN_SETTLE_EPSILON = 1

export type SearchSentinel = {
    readonly __searchableListSearch: true
    readonly key: typeof SEARCH_KEY
}

export type HeaderSentinel = {
    readonly __searchableListHeader: true
    readonly key: typeof HEADER_KEY
}

const SEARCH_SENTINEL: SearchSentinel = {
    __searchableListSearch: true,
    key: SEARCH_KEY,
}

const HEADER_SENTINEL: HeaderSentinel = {
    __searchableListHeader: true,
    key: HEADER_KEY,
}

export type AugmentedItem<T> = T | SearchSentinel | HeaderSentinel

export const isSearchSentinel = (item: unknown): item is SearchSentinel =>
    typeof item === 'object' &&
    item != null &&
    '__searchableListSearch' in item &&
    item.__searchableListSearch === true

export const isHeaderSentinel = (item: unknown): item is HeaderSentinel =>
    typeof item === 'object' &&
    item != null &&
    '__searchableListHeader' in item &&
    item.__searchableListHeader === true

/**
 * FlashList draws ItemSeparatorComponent between every adjacent pair, so
 * suppress it whenever either side is a header/search sentinel.
 */
export const isSeparatorSuppressed = (
    leadingItem: unknown,
    trailingItem: unknown,
): boolean =>
    isHeaderSentinel(leadingItem) ||
    isSearchSentinel(leadingItem) ||
    isHeaderSentinel(trailingItem) ||
    isSearchSentinel(trailingItem)

type UseSearchableListParams<T> = {
    forwardedRef: React.ForwardedRef<PWFlatListRef>
    data: readonly T[] | null | undefined
    keyExtractor?: (item: T, index: number) => string
    snapThreshold: number
    searchValue?: string
    onSearchChange?: (value: string) => void
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

type UseSearchableListResult<T> = {
    listRef: React.RefObject<Nullable<PWFlatListRef>>
    augmentedData: AugmentedItem<T>[]
    augmentedKeyExtractor: (item: AugmentedItem<T>, index: number) => string
    toUserIndex: (index: number) => number
    /**
     * Pixels of empty space the caller should append after the list items so
     * the search bar can always pin to the top, even when items don't fill
     * the viewport. 0 when the list already has enough scrollable content.
     */
    searchFooterHeight: number
    /** The single focusable overlay input's ref (for programmatic focus/blur). */
    overlayRef: React.RefObject<Nullable<SearchInputRef>>
    /** Search value mirrored by both the overlay and the sticky display. */
    currentValue: string
    /** Whether the focusable overlay should be shown (i.e. search mode). */
    showOverlay: boolean
    handleHeaderLayout: (event: LayoutChangeEvent) => void
    handleListLayout: (event: LayoutChangeEvent) => void
    handleContentSizeChange: (width: number, height: number) => void
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    handleScrollEndDrag: (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => void
    /** Exits search mode on drag (hides overlay, dismisses keyboard). */
    handleScrollBeginDrag: () => void
    /** Enters search mode: pins to top and focuses the overlay. */
    handleEnterSearch: () => void
    handleQueryChange: (text: string) => void
    handleClearQuery: () => void
    handleOverlayFocus: () => void
}

export const useSearchableList = <T>({
    forwardedRef,
    data,
    keyExtractor,
    snapThreshold,
    searchValue,
    onSearchChange,
    onScroll,
    onScrollEndDrag,
}: UseSearchableListParams<T>): UseSearchableListResult<T> => {
    const listRef = useRef<PWFlatListRef>(null)
    const overlayRef = useRef<SearchInputRef>(null)
    const [query, setQuery] = useState(searchValue ?? '')
    const [isSearching, setIsSearching] = useState(false)
    const currentValue = searchValue ?? query
    const showOverlay = isSearching
    const [headerHeight, setHeaderHeight] = useState(0)
    const [listLayoutHeight, setListLayoutHeight] = useState(0)
    // Latest measured contentSize minus the spacer footer we set last —
    // i.e. the natural (item-driven) content height.
    const [naturalContentSize, setNaturalContentSize] = useState(0)
    const searchFooterHeightRef = useRef(0)
    // The sticky search bar's onFocus closure can outlive a re-render, so
    // event handlers read these refs instead of state to always see the
    // freshest measurement.
    const headerHeightRef = useRef(0)
    const listLayoutHeightRef = useRef(0)
    // Tracks the itemCount from the previous render. When the new count is
    // lower we know data just shrunk and can pre-emptively grow the footer
    // synchronously — before the native list sees the smaller contentSize
    // and clamps scroll, which would otherwise expose the header.
    const previousItemCountRef = useRef(0)
    // Latched once the header has been fully hidden (offset >= headerHeight).
    // Snap logic only kicks in once latched — while the header is still
    // expanded or partially expanded, the user scrolls freely.
    const isCollapsedRef = useRef(false)
    // Last reported contentOffset.y. A ref, not state: it updates every scroll
    // frame and only ever needs reading imperatively.
    const scrollOffsetRef = useRef(0)
    // Mirrors `isSearching` for handleScroll's web-only unpin check below,
    // which needs the freshest value without retriggering the callback's
    // identity (handleScroll is passed straight through to the native scroll
    // event, so churning its reference on every keystroke is wasteful).
    const isSearchingRef = useRef(false)
    // Web-only: true once a scroll tick has actually landed at (within
    // WEB_PIN_SETTLE_EPSILON of) the pinned offset, i.e. handleSearchFocus's
    // own scrollToOffset animation has finished converging. Gates the unpin
    // check so that animation's own in-flight onScroll ticks don't
    // immediately undo the pin they're performing.
    const hasReachedWebPinOffsetRef = useRef(false)

    useLayoutEffect(() => {
        isSearchingRef.current = isSearching
        if (!isSearching) {
            hasReachedWebPinOffsetRef.current = false
        }
    }, [isSearching])

    useImperativeHandle(forwardedRef, () => ({
        scrollToOffset: params => listRef.current?.scrollToOffset(params),
        scrollToIndex: params => listRef.current?.scrollToIndex(params),
        scrollToEnd: options => listRef.current?.scrollToEnd(options),
    }))

    const itemCount = data?.length ?? 0

    const searchFooterHeight = useMemo(() => {
        if (listLayoutHeight <= 0) {
            return 0
        }
        // Use the natural size if we can or estimate it.
        let natural =
            naturalContentSize > 0
                ? naturalContentSize
                : headerHeight + itemCount * DEFAULT_ITEM_HEIGHT_ESTIMATE

        const previousItemCount = previousItemCountRef.current
        if (itemCount < previousItemCount) {
            const expectedLoss =
                (previousItemCount - itemCount) * DEFAULT_ITEM_HEIGHT_ESTIMATE
            natural = Math.max(0, natural - expectedLoss)
        }
        return Math.max(0, listLayoutHeight + headerHeight - natural)
    }, [listLayoutHeight, headerHeight, naturalContentSize, itemCount])

    // Mirror searchFooterHeight into a ref so handleContentSizeChange can
    // recover the natural size without depending on render closures.
    useLayoutEffect(() => {
        searchFooterHeightRef.current = searchFooterHeight
        previousItemCountRef.current = itemCount
    }, [searchFooterHeight, itemCount])

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height
        headerHeightRef.current = height
        setHeaderHeight(height)
    }, [])

    const handleListLayout = useCallback((event: LayoutChangeEvent) => {
        const height = event.nativeEvent.layout.height
        listLayoutHeightRef.current = height
        setListLayoutHeight(height)
    }, [])

    const handleContentSizeChange = useCallback(
        (_width: number, height: number) => {
            const natural = Math.max(0, height - searchFooterHeightRef.current)
            setNaturalContentSize(prev => (prev === natural ? prev : natural))
            // Backstop: if a transient contentSize drop pushed scroll below
            // the pin offset while collapsed, snap back synchronously so the
            // user never sees the header peek.
            //
            // Gated on actually being above the pin. Content size changes for
            // reasons that have nothing to do with a drop — a page appended, a
            // refetch swapping the array, recycled cells re-measuring after a
            // fast fling — and correcting unconditionally yanked a user reading
            // half way down the list back to the header, since the pin offset is
            // near the top of the content.
            //
            // If the platform clamps the offset before `onScroll` reports it,
            // this reads stale and skips a correction it could have made. That
            // direction is the safe one: a header that briefly peeks, rather
            // than a list that jumps under the reader.
            if (
                isCollapsedRef.current &&
                headerHeightRef.current > 0 &&
                scrollOffsetRef.current < headerHeightRef.current
            ) {
                listRef.current?.scrollToOffset({
                    offset: headerHeightRef.current,
                    animated: false,
                })
            }
        },
        [],
    )

    const handleSearchFocus = useCallback(() => {
        isCollapsedRef.current = true
        listRef.current?.scrollToOffset({
            offset: headerHeightRef.current,
            animated: true,
        })
    }, [])

    const handleQueryChange = useCallback(
        (text: string) => {
            setQuery(text)
            onSearchChange?.(text)
        },
        [onSearchChange],
    )

    const handleClearQuery = useCallback(() => {
        setQuery('')
        onSearchChange?.('')
    }, [onSearchChange])

    const handleOverlayFocus = useCallback(() => setIsSearching(true), [])

    // Tapping the sticky display: enter search mode, pin to the top (via
    // handleSearchFocus, which also arms the re-pin backstop), and focus the
    // overlay so a single tap opens the keyboard on the real input.
    const handleEnterSearch = useCallback(() => {
        setIsSearching(true)
        handleSearchFocus()
        requestAnimationFrame(() => overlayRef.current?.focus())
    }, [handleSearchFocus])

    // Exit search mode on drag only (NOT on blur — the clear button blurs
    // momentarily and exiting then would flash the overlay away mid-clear).
    const handleScrollBeginDrag = useCallback(() => {
        setIsSearching(false)
        overlayRef.current?.blur()
    }, [])

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            onScroll?.(event)
            const headerH = headerHeightRef.current
            const offsetY = event.nativeEvent.contentOffset.y
            // Latest known position, so handleContentSizeChange can tell a
            // scroll that drifted above the pin from one that is simply far down
            // the list.
            scrollOffsetRef.current = offsetY
            if (headerH > 0 && offsetY >= headerH) {
                isCollapsedRef.current = true
            }

            // Web has no onScrollBeginDrag/onScrollEndDrag to drive
            // handleScrollBeginDrag's unpin below (react-native-web's
            // ScrollView never emits them), so mirror native's "any scroll
            // gesture exits search mode" off the one signal that does fire
            // reliably on web: onScroll itself. Once the pin-scroll has
            // settled at headerH, any further movement away from it — either
            // direction — means the user is manually scrolling, so unpin.
            if (
                Platform.OS === 'web' &&
                isSearchingRef.current &&
                headerH > 0
            ) {
                const distanceFromPin = Math.abs(offsetY - headerH)
                if (!hasReachedWebPinOffsetRef.current) {
                    if (distanceFromPin <= WEB_PIN_SETTLE_EPSILON) {
                        hasReachedWebPinOffsetRef.current = true
                    }
                } else if (distanceFromPin > WEB_PIN_SETTLE_EPSILON) {
                    hasReachedWebPinOffsetRef.current = false
                    setIsSearching(false)
                    overlayRef.current?.blur()
                }
            }
        },
        [onScroll],
    )

    const handleScrollEndDrag = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            onScrollEndDrag?.(event)
            if (!isCollapsedRef.current) {
                return
            }
            const headerH = headerHeightRef.current
            if (headerH <= 0) {
                return
            }
            const offset = event.nativeEvent.contentOffset.y
            if (offset <= 0 || offset >= headerH) {
                return
            }
            const revealedFraction = (headerH - offset) / headerH
            if (revealedFraction > snapThreshold) {
                isCollapsedRef.current = false
                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                })
            } else {
                listRef.current?.scrollToOffset({
                    offset: headerH,
                    animated: true,
                })
            }
        },
        [onScrollEndDrag, snapThreshold],
    )

    // Search at index 1 (after the header) pins only once the header scrolls
    // away; at index 0 it would always pin, duplicating the in-flow bar.
    const augmentedData = useMemo<AugmentedItem<T>[]>(
        () => [HEADER_SENTINEL, SEARCH_SENTINEL, ...(data ?? [])],
        [data],
    )

    const toUserIndex = useCallback((index: number) => index - 2, [])

    const augmentedKeyExtractor = useCallback(
        (item: AugmentedItem<T>, index: number): string => {
            if (isHeaderSentinel(item)) {
                return HEADER_KEY
            }
            if (isSearchSentinel(item)) {
                return SEARCH_KEY
            }
            return keyExtractor?.(item as T, index - 2) ?? String(index - 2)
        },
        [keyExtractor],
    )

    return {
        listRef,
        augmentedData,
        augmentedKeyExtractor,
        toUserIndex,
        searchFooterHeight,
        overlayRef,
        currentValue,
        showOverlay,
        handleHeaderLayout,
        handleListLayout,
        handleContentSizeChange,
        handleScroll,
        handleScrollEndDrag,
        handleScrollBeginDrag,
        handleEnterSearch,
        handleQueryChange,
        handleClearQuery,
        handleOverlayFocus,
    }
}
