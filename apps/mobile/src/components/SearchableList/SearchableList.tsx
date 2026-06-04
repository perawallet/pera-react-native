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
    useMemo,
    useRef,
    useState,
} from 'react'
import { Pressable } from 'react-native'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWFlatList, PWView } from '@components/core'
import type { PWFlatListProps, PWFlatListRef } from '@components/core'
import { SearchInput, type SearchInputRef } from '@components/SearchInput'
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

const NOOP = () => {}
// testID for the real (focusable) overlay input; the sticky bar is a
// non-interactive display mirror.
const SEARCH_INPUT_TEST_ID = 'searchable-list-search-input'

type RenderItem<T> = (props: ListRenderItemInfo<T>) => React.ReactNode

export type SearchableListSearchProps = {
    value?: string
    placeholder?: string
    onChangeText?: (value: string) => void
    onFocus: () => void
    onBlur?: () => void
    editable?: boolean
    testID?: string
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

    // The search input lives in two places that mirror each other (same
    // SearchInput component, so they look identical): a native sticky list item
    // (display only — non-interactive, scrolls/pins via FlashList) and a single
    // focusable overlay shown only while actively searching. Typing happens in
    // the overlay (it lives outside the list, so list re-renders never remount
    // it — focus and text are preserved); its value mirrors into the display.
    //
    // Visibility is focus-driven, NOT scroll-driven: tying it to the scroll
    // offset blurs the input mid-type, because the animated scroll-to-pin
    // momentarily reads an un-pinned offset.
    const overlayRef = useRef<SearchInputRef>(null)
    const [query, setQuery] = useState(searchValue ?? '')
    const [isSearching, setIsSearching] = useState(false)
    const currentValue = searchValue ?? query
    const showOverlay = isSearching

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
        setIsSearching(true)
        handleSearchFocus()
        requestAnimationFrame(() => overlayRef.current?.focus())
    }, [handleSearchFocus])

    const handleOverlayFocus = useCallback(() => setIsSearching(true), [])
    const handleOverlayBlur = useCallback(() => setIsSearching(false), [])

    // Dragging dismisses the keyboard (blurs the overlay, which exits search
    // mode), handing the bar back to the native sticky display.
    const handleListScrollBeginDrag = useCallback(() => {
        overlayRef.current?.blur()
    }, [])

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
                // Display mirror: the same SearchInput so it looks identical to
                // the overlay, but non-interactive (editable=false + the
                // Pressable wrapper swallows taps). It scrolls/pins natively via
                // FlashList and shows the current query. Tapping pins to the top
                // and focuses the overlay (the real input). Hidden from
                // accessibility so there's a single announced search field.
                return (
                    <PWView style={styles.searchSticky}>
                        <Pressable
                            onPress={handleEnterSearch}
                            accessibilityElementsHidden
                            importantForAccessibility='no-hide-descendants'
                        >
                            <PWView pointerEvents='none'>
                                <SearchInputComponent
                                    value={currentValue}
                                    editable={false}
                                    placeholder={searchPlaceholder}
                                    onFocus={NOOP}
                                    onChangeText={NOOP}
                                />
                            </PWView>
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
            SearchInputComponent,
            handleEnterSearch,
            toUserIndex,
            ListHeaderComponent,
            handleHeaderLayout,
            styles.searchSticky,
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
        onScroll: handleScroll,
        onScrollBeginDrag: handleListScrollBeginDrag,
        onScrollEndDrag: handleScrollEndDrag,
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
            >
                <SearchInputComponent
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ref={overlayRef as any}
                    value={currentValue}
                    onFocus={handleOverlayFocus}
                    onBlur={handleOverlayBlur}
                    placeholder={searchPlaceholder}
                    onChangeText={handleQueryChange}
                    testID={SEARCH_INPUT_TEST_ID}
                />
            </PWView>
        </PWView>
    )
}

export const SearchableList = forwardRef(SearchableListInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
