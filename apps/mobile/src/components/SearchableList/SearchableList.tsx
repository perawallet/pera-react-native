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

import React, { createElement, forwardRef, useCallback, useMemo } from 'react'
import { type LayoutChangeEvent, type ScrollViewProps } from 'react-native'
import Animated, {
    useAnimatedRef,
    useScrollViewOffset,
    useAnimatedStyle,
    useSharedValue,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWFlatList, PWView } from '@components/core'
import type { PWFlatListProps, PWFlatListRef } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import {
    isHeaderSentinel,
    isSearchSentinel,
    isSeparatorSuppressed,
    useSearchableList,
    type AugmentedItem,
} from './useSearchableList'
import { DEFAULT_SNAP_THRESHOLD, SCROLL_EVENT_THROTTLE } from '@constants/ui'
import { Maybe } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'

type RenderItem<T> = (props: ListRenderItemInfo<T>) => React.ReactNode

export type SearchableListSearchProps = {
    value?: string
    placeholder?: string
    onChangeText?: (value: string) => void
    onFocus: () => void
    onBlur?: () => void
}

const renderHeaderNode = (
    component: Maybe<React.ComponentType | React.ReactElement>,
): React.ReactNode => {
    if (component == null) {
        return null
    }
    if (typeof component === 'function') {
        const Component = component
        return <Component />
    }
    return component
}

export type SearchableListProps<T> = Omit<
    PWFlatListProps<T>,
    'stickyHeaderIndices' | 'renderItem' | 'ListEmptyComponent'
> & {
    renderItem?: RenderItem<T>
    ListEmptyComponent?: Maybe<React.ComponentType | React.ReactElement>
    searchValue?: string
    searchPlaceholder?: string
    onSearchChange?: (value: string) => void
    SearchInputComponent?: React.ComponentType<SearchableListSearchProps>
    /**
     * Fraction of the header (`ListHeaderComponent`) revealed during a drag
     * required to snap to fully expanded; otherwise snap to fully collapsed
     * (search bar pinned). Defaults to 0.25.
     */
    snapThreshold?: number
}

const SearchableListInner = <T,>(
    props: SearchableListProps<T>,
    ref: React.ForwardedRef<PWFlatListRef>,
) => {
    const {
        ListHeaderComponent,
        ListEmptyComponent,
        ListFooterComponent,
        data,
        renderItem,
        keyExtractor,
        searchValue,
        searchPlaceholder,
        onSearchChange,
        SearchInputComponent = SearchInput,
        snapThreshold = DEFAULT_SNAP_THRESHOLD,
        onScroll,
        onScrollEndDrag,
        ItemSeparatorComponent: CallerSeparator,
        // children is part of the React props type but not used by the list.
        children: _children,
        extraData: callerExtraData,
        ...listProps
    } = props

    const {
        listRef,
        augmentedData,
        augmentedKeyExtractor,
        toUserIndex,
        searchFooterHeight,
        searchBarHeight,
        handleHeaderLayout,
        handleSearchBarLayout,
        handleListLayout,
        handleContentSizeChange,
        handleSearchFocus,
        handleScroll,
        handleScrollEndDrag,
    } = useSearchableList<T>({
        forwardedRef: ref,
        data,
        keyExtractor,
        snapThreshold,
        onScroll,
        onScrollEndDrag,
    })

    const styles = useStyles()

    const isListEmpty = (data?.length ?? 0) === 0

    // The search input is rendered once as an overlay (so list re-renders never
    // remount it and drop focus). Its position is driven by the scroll offset
    // read on the UI thread via reanimated. useScrollViewOffset needs the
    // animated ref on a real host ScrollView, so we hand FlashList a reanimated
    // Animated.ScrollView via renderScrollComponent and attach the ref there.
    const scrollViewRef = useAnimatedRef<Animated.ScrollView>()
    const scrollOffset = useScrollViewOffset(scrollViewRef)

    const headerHeightSV = useSharedValue(0)
    const isSearchFocusedSV = useSharedValue(false)

    const handleHeaderLayoutWithSV = useCallback(
        (event: LayoutChangeEvent) => {
            handleHeaderLayout(event)
            headerHeightSV.value = event.nativeEvent.layout.height
        },
        [handleHeaderLayout, headerHeightSV],
    )

    // Tracks the (UI-thread) scroll offset: sits below the header at rest,
    // slides up, pins at top. While focused (typing) it's force-pinned so the
    // filtered re-layout's transient scroll offset can't flash it. Dragging the
    // list dismisses the keyboard (keyboardDismissMode below), which blurs the
    // input and releases the pin — so scrolling down rides the header down with
    // the search instead of jumping.
    const searchOverlayStyle = useAnimatedStyle(() => {
        const headerH = headerHeightSV.value
        if (isSearchFocusedSV.value || headerH <= 0) {
            return { transform: [{ translateY: 0 }] }
        }
        return {
            transform: [
                {
                    translateY: interpolate(
                        scrollOffset.value,
                        [0, headerH],
                        [headerH, 0],
                        Extrapolation.CLAMP,
                    ),
                },
            ],
        }
    })

    const handleSearchInputFocus = useCallback(() => {
        handleSearchFocus()
        isSearchFocusedSV.value = true
    }, [handleSearchFocus, isSearchFocusedSV])

    const handleSearchInputBlur = useCallback(() => {
        isSearchFocusedSV.value = false
    }, [isSearchFocusedSV])

    // Reanimated Animated.ScrollView as FlashList's scroll component: forward
    // FlashList's own ref (scroll control) AND the animated ref (UI-thread
    // offset). Memoized so FlashList doesn't recreate the scroll view.
    const renderScrollComponent = useMemo(
        () =>
            forwardRef<Animated.ScrollView, ScrollViewProps>(
                (scrollProps, flashListScrollRef) => (
                    <Animated.ScrollView
                        {...scrollProps}
                        ref={(node: Animated.ScrollView | null) => {
                            if (typeof flashListScrollRef === 'function') {
                                flashListScrollRef(node)
                            } else if (flashListScrollRef) {
                                flashListScrollRef.current = node
                            }
                            // reanimated's ref is callable (real) or a plain
                            // object (test mock); support both.
                            const animatedRef = scrollViewRef as unknown as
                                | ((n: unknown) => void)
                                | { current: unknown }
                            if (typeof animatedRef === 'function') {
                                animatedRef(node)
                            } else if (animatedRef) {
                                animatedRef.current = node
                            }
                        }}
                    />
                ),
            ),
        [scrollViewRef],
    )

    const augmentedFooter = useMemo(() => {
        const emptyComponent = isListEmpty
            ? renderHeaderNode(ListEmptyComponent)
            : null
        const callerFooter = renderHeaderNode(ListFooterComponent)

        // Empty list: host the empty component in a container sized to the
        // leftover viewport space (searchFooterHeight) and center it, rather
        // than rendering it at the top with the spacer below. The container
        // itself supplies the fill, so the search bar still pins as before.
        if (emptyComponent != null) {
            return (
                <>
                    <PWView
                        style={[
                            styles.emptyFill,
                            searchFooterHeight > 0 && {
                                height: searchFooterHeight,
                            },
                        ]}
                    >
                        {emptyComponent}
                    </PWView>
                    {callerFooter}
                </>
            )
        }

        if (callerFooter == null && searchFooterHeight <= 0) {
            return null
        }
        return (
            <>
                {callerFooter}
                {searchFooterHeight > 0 && (
                    <PWView style={{ height: searchFooterHeight }} />
                )}
            </>
        )
    }, [
        ListEmptyComponent,
        ListFooterComponent,
        isListEmpty,
        searchFooterHeight,
        styles.emptyFill,
    ])

    const augmentedRenderItem = useCallback<RenderItem<AugmentedItem<T>>>(
        info => {
            if (isHeaderSentinel(info.item)) {
                return (
                    <PWView onLayout={handleHeaderLayoutWithSV}>
                        {renderHeaderNode(ListHeaderComponent)}
                    </PWView>
                )
            }
            if (isSearchSentinel(info.item)) {
                // Reserve the search bar's height; the real input is rendered
                // once as an overlay (below) so it survives list re-renders
                // without losing focus or its text.
                return <PWView style={{ height: searchBarHeight }} />
            }
            return (
                renderItem?.({
                    ...info,
                    item: info.item,
                    index: toUserIndex(info.index),
                }) ?? null
            )
        },
        [
            renderItem,
            searchBarHeight,
            toUserIndex,
            ListHeaderComponent,
            handleHeaderLayoutWithSV,
        ],
    )

    // FlashList draws ItemSeparatorComponent between every adjacent pair, so
    // wrap the caller's to skip pairs touching a sentinel. With no caller
    // separator we draw nothing, else PWFlatList's default divider reappears.
    const augmentedSeparator = useMemo(() => {
        if (CallerSeparator == null) {
            return null
        }
        const Separator = CallerSeparator
        const WrappedSeparator = ({
            leadingItem,
            trailingItem,
        }: {
            leadingItem?: unknown
            trailingItem?: unknown
        }) => {
            if (isSeparatorSuppressed(leadingItem, trailingItem)) {
                return null
            }
            return (
                <Separator
                    leadingItem={leadingItem}
                    trailingItem={trailingItem}
                />
            )
        }
        return WrappedSeparator
    }, [CallerSeparator])

    const augmentedExtraData = useMemo(
        () =>
            callerExtraData !== undefined
                ? [callerExtraData, searchValue]
                : searchValue,
        [callerExtraData, searchValue],
    )

    // PWFlatList's generic forwarded-ref signature doesn't unify with the
    // prop object we build here via JSX, so we go through createElement with a
    // single `any` to bridge it; everything we *write* (data, renderItem,
    // keyExtractor, etc.) is properly typed above. FlashList enables
    // maintainVisibleContentPosition by default, so it isn't set explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = createElement(PWFlatList as any, {
        ...listProps,
        ref: listRef,
        data: augmentedData,
        renderItem: augmentedRenderItem,
        keyExtractor: augmentedKeyExtractor,
        ItemSeparatorComponent: augmentedSeparator,
        ListFooterComponent: augmentedFooter,
        renderScrollComponent,
        // Dragging dismisses the keyboard, which blurs the search and releases
        // the focus-pin so the overlay tracks the scroll while the header
        // returns (no slide-under / jump).
        keyboardDismissMode: 'on-drag',
        // Zero PWFlatList's default paddingTop, else the search overlay pins a
        // gap above the in-flow header.
        contentContainerStyle: [
            listProps.contentContainerStyle,
            styles.content,
        ],
        extraData: augmentedExtraData,
        onLayout: handleListLayout,
        onContentSizeChange: handleContentSizeChange,
        onScroll: handleScroll,
        onScrollEndDrag: handleScrollEndDrag,
        scrollEventThrottle: SCROLL_EVENT_THROTTLE,
    })

    return (
        <PWView style={styles.root}>
            {list}
            <Animated.View
                style={[styles.searchOverlay, searchOverlayStyle]}
                onLayout={handleSearchBarLayout}
            >
                <SearchInputComponent
                    value={searchValue}
                    onFocus={handleSearchInputFocus}
                    onBlur={handleSearchInputBlur}
                    placeholder={searchPlaceholder}
                    onChangeText={onSearchChange}
                />
            </Animated.View>
        </PWView>
    )
}

export const SearchableList = forwardRef(SearchableListInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
