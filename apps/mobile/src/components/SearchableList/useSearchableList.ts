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

import {
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native'

import type { PWFlatListRef } from '@components/core'

const SEARCH_SENTINEL = Symbol('SearchableList.search')
const SEARCH_KEY = '__searchable_list_search__'

export type SearchSentinel = typeof SEARCH_SENTINEL

export type AugmentedItem<T> = T | SearchSentinel

export const isSearchSentinel = (item: unknown): item is SearchSentinel =>
    item === SEARCH_SENTINEL

type UseSearchableListParams<T> = {
    forwardedRef: React.ForwardedRef<PWFlatListRef>
    data: readonly T[] | null | undefined
    keyExtractor?: (item: T, index: number) => string
    snapThreshold: number
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

type UseSearchableListResult<T> = {
    listRef: React.RefObject<PWFlatListRef | null>
    augmentedData: AugmentedItem<T>[]
    augmentedKeyExtractor: (item: AugmentedItem<T>, index: number) => string
    toUserIndex: (index: number) => number
    /**
     * Pixels of empty space the caller should append after the list items so
     * the search bar can always pin to the top, even when items don't fill
     * the viewport. 0 when the list already has enough scrollable content.
     */
    searchFooterHeight: number
    handleHeaderLayout: (event: LayoutChangeEvent) => void
    handleListLayout: (event: LayoutChangeEvent) => void
    handleContentSizeChange: (width: number, height: number) => void
    handleSearchFocus: () => void
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    handleScrollEndDrag: (
        event: NativeSyntheticEvent<NativeScrollEvent>,
    ) => void
}

export const useSearchableList = <T>({
    forwardedRef,
    data,
    keyExtractor,
    snapThreshold,
    onScroll,
    onScrollEndDrag,
}: UseSearchableListParams<T>): UseSearchableListResult<T> => {
    const listRef = useRef<PWFlatListRef>(null)
    const headerHeightRef = useRef(0)
    const listLayoutHeightRef = useRef(0)
    const naturalContentSizeRef = useRef(0)
    const searchFooterHeightRef = useRef(0)
    const [searchFooterHeight, setSearchFooterHeight] = useState(0)
    // Latched once the header has been fully hidden (offset >= headerHeight).
    // Snap logic only kicks in once latched — while the header is still
    // expanded or partially expanded, the user scrolls freely.
    const isCollapsedRef = useRef(false)

    const updateFooterIfNeeded = useCallback(() => {
        const viewport = listLayoutHeightRef.current
        const natural = naturalContentSizeRef.current
        // Wait for both measurements before computing — otherwise we'd
        // briefly add a viewport-sized footer and have to undo it.
        if (viewport <= 0 || natural <= 0) {
            return
        }
        // Pad just enough that contentSize == viewport + headerHeight, so the
        // max scroll offset equals headerHeight — letting the sticky search
        // bar pin to the top even when items don't fill the viewport, while
        // never letting the user scroll past the search bar.
        const desired = Math.max(
            0,
            viewport + headerHeightRef.current - natural,
        )
        if (searchFooterHeightRef.current !== desired) {
            searchFooterHeightRef.current = desired
            setSearchFooterHeight(desired)
        }
    }, [])

    useImperativeHandle(forwardedRef, () => ({
        scrollToOffset: params => listRef.current?.scrollToOffset(params),
        scrollToIndex: params => listRef.current?.scrollToIndex(params),
        scrollToEnd: options => listRef.current?.scrollToEnd(options),
    }))

    const handleHeaderLayout = useCallback(
        (event: LayoutChangeEvent) => {
            headerHeightRef.current = event.nativeEvent.layout.height
            updateFooterIfNeeded()
        },
        [updateFooterIfNeeded],
    )

    const handleListLayout = useCallback(
        (event: LayoutChangeEvent) => {
            listLayoutHeightRef.current = event.nativeEvent.layout.height
            updateFooterIfNeeded()
        },
        [updateFooterIfNeeded],
    )

    const handleContentSizeChange = useCallback(
        (_width: number, height: number) => {
            // Track the content size minus our spacer so updateFooterIfNeeded
            // always reasons about the natural (item-driven) size, not the
            // inflated size after we've added the spacer.
            naturalContentSizeRef.current =
                height - searchFooterHeightRef.current
            updateFooterIfNeeded()
        },
        [updateFooterIfNeeded],
    )

    const handleSearchFocus = useCallback(() => {
        // Animate to the offset where the sticky search bar pins to the top
        // — the list's native scroll animation provides the collapse motion.
        isCollapsedRef.current = true
        listRef.current?.scrollToOffset({
            offset: headerHeightRef.current,
            animated: true,
        })
    }, [])

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            onScroll?.(event)
            const headerHeight = headerHeightRef.current
            if (
                headerHeight > 0 &&
                event.nativeEvent.contentOffset.y >= headerHeight
            ) {
                isCollapsedRef.current = true
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
            const headerHeight = headerHeightRef.current
            if (headerHeight <= 0) {
                return
            }
            const offset = event.nativeEvent.contentOffset.y
            if (offset <= 0 || offset >= headerHeight) {
                return
            }
            const revealedFraction = (headerHeight - offset) / headerHeight
            if (revealedFraction > snapThreshold) {
                isCollapsedRef.current = false
                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                })
            } else {
                listRef.current?.scrollToOffset({
                    offset: headerHeight,
                    animated: true,
                })
            }
        },
        [onScrollEndDrag, snapThreshold],
    )

    const augmentedData = useMemo<AugmentedItem<T>[]>(
        () => [SEARCH_SENTINEL, ...(data ?? [])],
        [data],
    )

    const toUserIndex = useCallback((index: number) => index - 1, [])

    const augmentedKeyExtractor = useCallback(
        (item: AugmentedItem<T>, index: number): string => {
            if (item === SEARCH_SENTINEL) {
                return SEARCH_KEY
            }
            return keyExtractor?.(item as T, index - 1) ?? String(index - 1)
        },
        [keyExtractor],
    )

    return {
        listRef,
        augmentedData,
        augmentedKeyExtractor,
        toUserIndex,
        searchFooterHeight,
        handleHeaderLayout,
        handleListLayout,
        handleContentSizeChange,
        handleSearchFocus,
        handleScroll,
        handleScrollEndDrag,
    }
}
