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

import React, { createElement, forwardRef, useCallback, useMemo } from 'react'
import { Pressable } from 'react-native'

import { PWFlatList, PWView, type PWFlatListRef } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { SearchInputTrigger } from '@components/SearchInputTrigger'
import {
    isHeaderSentinel,
    isSearchSentinel,
    isSeparatorSuppressed,
    useSearchableList,
    type AugmentedItem,
} from '../useSearchableList'
import { DEFAULT_SNAP_THRESHOLD, SCROLL_EVENT_THROTTLE } from '@constants/ui'
import type { Maybe } from '@perawallet/wallet-core-shared'
import { useStyles } from '../styles'
import type { RenderItem, SearchableListProps } from '../SearchableList'

// testID for the real (focusable) overlay input; the sticky bar is a
// non-interactive display mirror.
const SEARCH_INPUT_TEST_ID = 'searchable-list-search-input'

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

export type SearchableListFullProps<T> = SearchableListProps<T>

const SearchableListFullInner = <T,>(
    props: SearchableListFullProps<T>,
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
        searchAccessory,
        onScroll,
        onScrollEndDrag,
        ItemSeparatorComponent: CallerSeparator,
        // children is part of the React props type but not used by the list.
        children: _children,
        extraData: callerExtraData,
        ...listProps
    } = props

    // The search input is mirrored (a focusable overlay + a non-interactive
    // sticky display) to work around FlashList re-rendering the sticky cell and
    // dropping focus while typing. All of that state/coordination lives in the
    // hook; this component just renders it.
    const {
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
    } = useSearchableList<T>({
        forwardedRef: ref,
        data,
        keyExtractor,
        snapThreshold,
        searchValue,
        onSearchChange,
        onScroll,
        onScrollEndDrag,
    })

    const styles = useStyles()

    const isListEmpty = (data?.length ?? 0) === 0

    const augmentedFooter = useMemo(() => {
        const emptyComponent = isListEmpty
            ? renderHeaderNode(ListEmptyComponent)
            : null
        const callerFooter = renderHeaderNode(ListFooterComponent)

        // Empty list: host the empty component in a container sized to the
        // leftover viewport space (searchFooterHeight) and center it (to account for keyboard).
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
                // the overlay, but non-interactive. Keyboard dismiss is off so
                // it doesn't fight handleEnterSearch focusing the overlay.
                return (
                    <PWView style={styles.searchSticky}>
                        {/* Bounds the clear hit area to the input, so it never
                            covers the accessory below. */}
                        <PWView>
                            <SearchInputTrigger
                                onPress={handleEnterSearch}
                                value={currentValue}
                                placeholder={searchPlaceholder}
                                SearchInputComponent={SearchInputComponent}
                                displayStyle={
                                    showOverlay
                                        ? styles.searchOverlayHidden
                                        : undefined
                                }
                                dismissKeyboardOnPress={false}
                                accessibilityElementsHidden
                                importantForAccessibility='no-hide-descendants'
                            />
                            {/* Transparent tap target over the visible clear (X):
                                clears in place without pinning. Rendered last so
                                it sits above the body Pressable. */}
                            {currentValue ? (
                                <Pressable
                                    style={styles.searchClearHitArea}
                                    onPress={handleClearQuery}
                                    accessibilityLabel='Clear search'
                                />
                            ) : null}
                        </PWView>
                        {searchAccessory != null ? (
                            <PWView style={styles.searchAccessory}>
                                {searchAccessory}
                            </PWView>
                        ) : null}
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
            showOverlay,
            handleEnterSearch,
            handleClearQuery,
            toUserIndex,
            ListHeaderComponent,
            handleHeaderLayout,
            styles.searchSticky,
            styles.searchAccessory,
            searchAccessory,
            styles.searchClearHitArea,
            styles.searchOverlayHidden,
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
    // prop object we build here via JSX.
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
        onScrollBeginDrag: handleScrollBeginDrag,
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
                    placeholder={searchPlaceholder}
                    onChangeText={handleQueryChange}
                    testID={SEARCH_INPUT_TEST_ID}
                />
            </PWView>
        </PWView>
    )
}

export const SearchableListFull = forwardRef(SearchableListFullInner) as <T>(
    props: SearchableListFullProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
