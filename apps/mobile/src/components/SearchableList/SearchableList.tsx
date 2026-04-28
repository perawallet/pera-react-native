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

type RenderItem<T> = (props: LegendListRenderItemProps<T>) => React.ReactNode

const renderHeaderNode = (
    component: React.ComponentType | React.ReactElement | null | undefined,
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
    'stickyIndices' | 'renderItem'
> & {
    renderItem?: RenderItem<T>
    searchValue?: string
    searchPlaceholder?: string
    onSearchChange?: (value: string) => void
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
        ListFooterComponent,
        data,
        renderItem,
        keyExtractor,
        searchValue,
        searchPlaceholder,
        onSearchChange,
        snapThreshold = DEFAULT_SNAP_THRESHOLD,
        onScroll,
        onScrollEndDrag,
        // children is part of the React props type but not used by the list.
        children: _children,
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

    const augmentedFooter = useMemo(() => {
        const callerFooter = renderHeaderNode(ListFooterComponent)
        if (searchFooterHeight <= 0 && callerFooter == null) {
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
    }, [ListFooterComponent, searchFooterHeight])

    const augmentedRenderItem = useCallback<RenderItem<AugmentedItem<T>>>(
        info => {
            if (isSearchSentinel(info.item)) {
                return (
                    <SearchInput
                        value={searchValue}
                        onFocus={handleSearchFocus}
                        placeholder={searchPlaceholder}
                        onChangeText={onSearchChange}
                    />
                )
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
            handleSearchFocus,
            toUserIndex,
        ],
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
