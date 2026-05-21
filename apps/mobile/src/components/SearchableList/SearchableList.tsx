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
import type { LegendListRenderItemProps } from '@legendapp/list'

import { PWFlatList, PWView } from '@components/core'
import type { PWFlatListProps, PWFlatListRef } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import {
    isSearchSentinel,
    useSearchableList,
    type AugmentedItem,
} from './useSearchableList'
import { DEFAULT_SNAP_THRESHOLD, SCROLL_EVENT_THROTTLE } from '@constants/ui'
import { Maybe } from '@perawallet/wallet-core-shared'

type RenderItem<T> = (props: LegendListRenderItemProps<T>) => React.ReactNode

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
    'stickyIndices' | 'renderItem' | 'ListEmptyComponent'
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
        itemHeightEstimate: listProps.estimatedItemSize,
        onScroll,
        onScrollEndDrag,
    })

    const augmentedHeader = useMemo(
        () => (
            <PWView onLayout={handleHeaderLayout}>
                {renderHeaderNode(ListHeaderComponent)}
            </PWView>
        ),
        [ListHeaderComponent, handleHeaderLayout],
    )

    const isListEmpty = (data?.length ?? 0) === 0

    const augmentedFooter = useMemo(() => {
        const emptyComponent = isListEmpty
            ? renderHeaderNode(ListEmptyComponent)
            : null
        const callerFooter = renderHeaderNode(ListFooterComponent)
        if (
            emptyComponent == null &&
            callerFooter == null &&
            searchFooterHeight <= 0
        ) {
            return null
        }
        return (
            <>
                {emptyComponent}
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
    ])

    const augmentedRenderItem = useCallback<RenderItem<AugmentedItem<T>>>(
        info => {
            if (isSearchSentinel(info.item)) {
                const searchProps = {
                    value: searchValue,
                    onFocus: handleSearchFocus,
                    placeholder: searchPlaceholder,
                    onChangeText: onSearchChange,
                }

                return <SearchInputComponent {...searchProps} />
            }
            return (
                renderItem?.({
                    ...info,
                    item: info.item,
                    index: toUserIndex(info.index),
                    data: (info.data?.slice(1) ?? []) as readonly T[],
                }) ?? null
            )
        },
        [
            renderItem,
            searchValue,
            searchPlaceholder,
            onSearchChange,
            SearchInputComponent,
            handleSearchFocus,
            toUserIndex,
        ],
    )

    const augmentedExtraData = useMemo(
        () =>
            callerExtraData !== undefined
                ? [callerExtraData, searchValue]
                : searchValue,
        [callerExtraData, searchValue],
    )
    
    // LegendList's data-mode prop type uses `children: never`, while React's
    // intrinsic component types always add `children?: ReactNode` — so any
    // structural cast at this boundary fails. The single `any` here is
    // strictly to bridge that mismatch; everything we *write* (data,
    // renderItem, keyExtractor, etc.) is properly typed above.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createElement(PWFlatList as any, {
        ...listProps,
        ref: listRef,
        data: augmentedData,
        renderItem: augmentedRenderItem,
        keyExtractor: augmentedKeyExtractor,
        ListHeaderComponent: augmentedHeader,
        ListFooterComponent: augmentedFooter,
        stickyIndices: [0],
        maintainVisibleContentPosition: true,
        extraData: augmentedExtraData,
        onLayout: handleListLayout,
        onContentSizeChange: handleContentSizeChange,
        onScroll: handleScroll,
        onScrollEndDrag: handleScrollEndDrag,
        scrollEventThrottle: SCROLL_EVENT_THROTTLE,
    })
}

export const SearchableList = forwardRef(SearchableListInner) as <T>(
    props: SearchableListProps<T> & React.RefAttributes<PWFlatListRef>,
) => React.ReactElement
