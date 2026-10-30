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

import React, { createElement, forwardRef } from 'react'

import { PWFlatList, PWView, type PWFlatListRef } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { useSearchableList } from '../useSearchableList'
import { DEFAULT_SNAP_THRESHOLD, SCROLL_EVENT_THROTTLE } from '@constants/ui'
import { useStyles } from '../styles'
import type { SearchableListProps } from '../SearchableList'
import { useSearchableListFull } from './useSearchableListFull'

// testID for the real (focusable) overlay input; the sticky bar is a
// non-interactive display mirror.
const SEARCH_INPUT_TEST_ID = 'searchable-list-search-input'

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

    const {
        augmentedFooter,
        augmentedRenderItem,
        augmentedSeparator,
        augmentedExtraData,
    } = useSearchableListFull<T>({
        ListHeaderComponent,
        ListEmptyComponent,
        ListFooterComponent,
        CallerSeparator,
        renderItem,
        searchValue,
        searchPlaceholder,
        SearchInputComponent,
        searchAccessory,
        callerExtraData,
        isListEmpty,
        searchFooterHeight,
        currentValue,
        showOverlay,
        handleEnterSearch,
        handleClearQuery,
        toUserIndex,
        handleHeaderLayout,
    })

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
