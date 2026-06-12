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

import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWFlatList, PWView, type PWFlatListRef } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import type { SearchableListProps } from './SearchableList'
import { useStyles } from './styles'

const SEARCH_INPUT_TEST_ID = 'searchable-list-search-input'
const noop = () => undefined

// Bottom-sheet render path: a pinned (non-collapsing) search bar above a
// PWFlatList(inBottomSheet). The collapse-on-scroll / focusable-overlay /
// snap machinery used on full screens conflicts with @gorhom's
// BottomSheetScrollable gesture coordination, so we deliberately skip it here.
const SearchableListSheetInner = <T,>(
    props: SearchableListProps<T>,
    ref: React.ForwardedRef<PWFlatListRef>,
) => {
    const {
        data,
        renderItem,
        keyExtractor,
        searchValue,
        searchPlaceholder,
        onSearchChange,
        SearchInputComponent = SearchInput,
        autoFocusSearch,
        ListHeaderComponent,
        ListEmptyComponent,
        ListFooterComponent,
        ItemSeparatorComponent,
        snapThreshold: _snapThreshold,
        onScrollEndDrag: _onScrollEndDrag,
        inBottomSheet: _inBottomSheet,
        children: _children,
        ...listProps
    } = props

    const styles = useStyles()
    const listRef = useRef<PWFlatListRef>(null)

    useImperativeHandle(ref, () => ({
        scrollToOffset: params => listRef.current?.scrollToOffset(params),
        scrollToIndex: params => listRef.current?.scrollToIndex(params),
        scrollToEnd: options => listRef.current?.scrollToEnd(options),
    }))

    return (
        <PWView style={styles.root}>
            <PWView style={styles.sheetSearchContainer}>
                <SearchInputComponent
                    value={searchValue}
                    placeholder={searchPlaceholder}
                    onChangeText={onSearchChange}
                    onFocus={noop}
                    autoFocus={autoFocusSearch}
                    testID={SEARCH_INPUT_TEST_ID}
                />
            </PWView>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {React.createElement(PWFlatList as any, {
                ...listProps,
                ref: listRef,
                inBottomSheet: true,
                data,
                renderItem: renderItem as (
                    info: ListRenderItemInfo<T>,
                ) => React.ReactElement,
                keyExtractor,
                ListHeaderComponent,
                ListEmptyComponent,
                ListFooterComponent,
                ItemSeparatorComponent,
            })}
        </PWView>
    )
}

export const SearchableListSheet = forwardRef(SearchableListSheetInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
