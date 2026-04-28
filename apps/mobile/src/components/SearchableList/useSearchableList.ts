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
    useLayoutEffect,
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
const DEFAULT_ITEM_HEIGHT_ESTIMATE = 56

export type SearchSentinel = typeof SEARCH_SENTINEL

export type AugmentedItem<T> = T | SearchSentinel

export const isSearchSentinel = (item: unknown): item is SearchSentinel =>
    item === SEARCH_SENTINEL

type UseSearchableListParams<T> = {
    forwardedRef: React.ForwardedRef<PWFlatListRef>
    data: readonly T[] | null | undefined
    keyExtractor?: (item: T, index: number) => string
    snapThreshold: number
    itemHeightEstimate?: number
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
    itemHeightEstimate = DEFAULT_ITEM_HEIGHT_ESTIMATE,
    onScroll,
    onScrollEndDrag,
}: UseSearchableListParams<T>): UseSearchableListResult<T> => {
    const listRef = useRef<PWFlatListRef>(null)
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
        // Use the natural size is fwe can or estimate it
        let natural =
            naturalContentSize > 0
                ? naturalContentSize
                : headerHeight + itemCount * itemHeightEstimate
        
        const previousItemCount = previousItemCountRef.current
        if (itemCount < previousItemCount) {
            const expectedLoss =
                (previousItemCount - itemCount) * itemHeightEstimate
            natural = Math.max(0, natural - expectedLoss)
        }
        return Math.max(0, listLayoutHeight + headerHeight - natural)
    }, [
        listLayoutHeight,
        headerHeight,
        naturalContentSize,
        itemCount,
        itemHeightEstimate,
    ])

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
            const natural = Math.max(
                0,
                height - searchFooterHeightRef.current,
            )
            setNaturalContentSize(prev => (prev === natural ? prev : natural))
            // Backstop: if a transient contentSize drop pushed scroll below
            // the pin offset while collapsed, snap back synchronously so the
            // user never sees the header peek.
            if (
                isCollapsedRef.current &&
                headerHeightRef.current > 0
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

    const handleScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            onScroll?.(event)
            const headerH = headerHeightRef.current
            if (
                headerH > 0 &&
                event.nativeEvent.contentOffset.y >= headerH
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
