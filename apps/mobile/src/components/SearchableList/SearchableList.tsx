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

import React, {
    createElement,
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    Pressable,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from 'react-native'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWFlatList, PWText, PWView } from '@components/core'
import { PWIcon } from '@components/core/PWIcon'
import type { PWFlatListProps, PWFlatListRef } from '@components/core'
import { SearchInput, type SearchInputRef } from '@components/SearchInput'

// How close to the pinned position counts as "pinned" (px tolerance).
const PIN_EPSILON = 2
const NOOP = () => {}
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
        headerHeight,
        handleHeaderLayout,
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

    // The search input lives in two places that mirror each other: a native
    // sticky list item (display only — it scrolls/pins via FlashList) and a
    // single focusable overlay shown only while pinned at the top and not
    // dragging. Typing happens in the overlay (it never remounts, so it keeps
    // focus); its value is mirrored into the sticky display. On drag the
    // overlay hides and the native sticky takes over — no scroll-driven
    // animation, so nothing fights FlashList's scroll under load.
    const overlayRef = useRef<SearchInputRef>(null)
    const [query, setQuery] = useState(searchValue ?? '')
    const [isPinned, setIsPinned] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    // Measured height of the real input (the overlay), applied to the sticky
    // display so the two are exactly the same height — otherwise the handoff
    // between them jumps.
    const [searchBarHeight, setSearchBarHeight] = useState(0)
    const currentValue = searchValue ?? query
    const showOverlay = isPinned && !isDragging

    const handleQueryChange = useCallback(
        (text: string) => {
            setQuery(text)
            onSearchChange?.(text)
        },
        [onSearchChange],
    )

    const handleEnterSearch = useCallback(() => {
        // Pin to the top and focus the overlay so a single tap on the sticky
        // bar opens the keyboard on the real input. handleSearchFocus sets the
        // hook's collapsed latch, which arms its re-pin-on-content-change
        // backstop — without it, the first keystroke shrinks the list and the
        // header peeks back in.
        setIsPinned(true)
        handleSearchFocus()
        requestAnimationFrame(() => overlayRef.current?.focus())
    }, [handleSearchFocus])

    const handleListScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            handleScroll(event)
            const y = event.nativeEvent.contentOffset.y
            setIsPinned(y >= headerHeight - PIN_EPSILON)
        },
        [handleScroll, headerHeight],
    )

    const handleListScrollBeginDrag = useCallback(() => {
        setIsDragging(true)
    }, [])

    const handleListScrollEndDrag = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            handleScrollEndDrag(event)
            setIsDragging(false)
        },
        [handleScrollEndDrag],
    )

    const handleMomentumScrollEnd = useCallback(() => {
        setIsDragging(false)
    }, [])

    // Drop the keyboard whenever the overlay is hidden (e.g. on drag start).
    useEffect(() => {
        if (!showOverlay) overlayRef.current?.blur()
    }, [showOverlay])

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
                    <PWView onLayout={handleHeaderLayout}>
                        {renderHeaderNode(ListHeaderComponent)}
                    </PWView>
                )
            }
            if (isSearchSentinel(info.item)) {
                // Display-only mirror (not a real input, so there's a single
                // search field): it scrolls/pins natively via FlashList and
                // shows the current query. Tapping it pins to the top and
                // focuses the overlay (the real input).
                return (
                    <PWView style={styles.searchSticky}>
                        <Pressable
                            style={[
                                styles.searchDisplay,
                                searchBarHeight > 0 && {
                                    height: searchBarHeight,
                                },
                            ]}
                            onPress={handleEnterSearch}
                        >
                            <PWIcon
                                name='magnifying-glass'
                                variant='secondary'
                            />
                            <PWText
                                variant='body'
                                numberOfLines={1}
                                style={
                                    currentValue
                                        ? styles.searchDisplayText
                                        : styles.searchDisplayPlaceholder
                                }
                            >
                                {currentValue || searchPlaceholder}
                            </PWText>
                        </Pressable>
                    </PWView>
                )
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
            currentValue,
            searchPlaceholder,
            handleEnterSearch,
            searchBarHeight,
            toUserIndex,
            ListHeaderComponent,
            handleHeaderLayout,
            styles.searchSticky,
            styles.searchDisplay,
            styles.searchDisplayText,
            styles.searchDisplayPlaceholder,
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
        stickyHeaderIndices: isListEmpty ? undefined : [1],
        // Zero PWFlatList's default paddingTop, else the sticky search pins a
        // gap above the in-flow header.
        contentContainerStyle: [
            listProps.contentContainerStyle,
            styles.content,
        ],
        extraData: augmentedExtraData,
        onLayout: handleListLayout,
        onContentSizeChange: handleContentSizeChange,
        onScroll: handleListScroll,
        onScrollBeginDrag: handleListScrollBeginDrag,
        onScrollEndDrag: handleListScrollEndDrag,
        onMomentumScrollEnd: handleMomentumScrollEnd,
        scrollEventThrottle: SCROLL_EVENT_THROTTLE,
    })

    return (
        <PWView style={styles.root}>
            {list}
            <PWView
                style={[
                    styles.searchOverlay,
                    !showOverlay && styles.searchOverlayHidden,
                ]}
                pointerEvents={showOverlay ? 'auto' : 'none'}
                onLayout={event => {
                    const h = event.nativeEvent.layout.height
                    if (h > 0) {
                        setSearchBarHeight(prev => (prev === h ? prev : h))
                    }
                }}
            >
                <SearchInputComponent
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ref={overlayRef as any}
                    value={currentValue}
                    onFocus={NOOP}
                    placeholder={searchPlaceholder}
                    onChangeText={handleQueryChange}
                />
            </PWView>
        </PWView>
    )
}

export const SearchableList = forwardRef(SearchableListInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
