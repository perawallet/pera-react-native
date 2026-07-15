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

import React, { useCallback, useMemo } from 'react'
import { ActivityIndicator } from 'react-native'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWView } from '@components/core'
import { SearchableList } from '@components/SearchableList'
import { AssetRowSkeleton } from '@modules/assets/components/AssetRowSkeleton'
import { useStyles } from './styles'

type SkeletonItem = { readonly __assetSkeleton: true; readonly id: string }

const isSkeletonItem = (item: unknown): item is SkeletonItem =>
    typeof item === 'object' && item !== null && '__assetSkeleton' in item

export type AssetSelectionListProps<T> = {
    data: readonly T[] | null | undefined
    renderItem: (info: ListRenderItemInfo<T>) => React.ReactNode
    keyExtractor: (item: T) => string

    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    autoFocusSearch?: boolean

    isLoading?: boolean
    skeletonCount?: number
    ListEmptyComponent?: React.ComponentType | React.ReactElement
    ListHeaderComponent?: React.ComponentType | React.ReactElement

    onEndReached?: () => void
    isFetchingNextPage?: boolean

    ItemSeparatorComponent?: React.ComponentType | null
    cardLayout?: boolean
    inBottomSheet?: boolean
}

export const AssetSelectionList = <T,>({
    data,
    renderItem,
    keyExtractor,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    autoFocusSearch,
    isLoading = false,
    skeletonCount = 5,
    ListEmptyComponent,
    ListHeaderComponent,
    onEndReached,
    isFetchingNextPage = false,
    ItemSeparatorComponent,
    cardLayout,
    inBottomSheet = true,
}: AssetSelectionListProps<T>) => {
    const styles = useStyles()

    // While the initial load is in-flight, render skeleton rows as list data so
    // they're top-aligned and full-width (instead of a centered empty state).
    const showSkeletons = isLoading && (data?.length ?? 0) === 0

    const skeletonItems = useMemo<SkeletonItem[]>(
        () =>
            Array.from({ length: skeletonCount }, (_, i) => ({
                __assetSkeleton: true as const,
                id: `asset-skeleton-${i}`,
            })),
        [skeletonCount],
    )

    const listData = (
        showSkeletons ? skeletonItems : (data ?? [])
    ) as readonly (T | SkeletonItem)[]

    const renderRow = useCallback(
        (info: ListRenderItemInfo<T | SkeletonItem>) => {
            if (isSkeletonItem(info.item)) {
                return (
                    <PWView style={styles.skeletonRow}>
                        <AssetRowSkeleton />
                    </PWView>
                )
            }
            return renderItem(info as ListRenderItemInfo<T>)
        },
        [renderItem, styles],
    )

    const keyExtractorFn = useCallback(
        (item: T | SkeletonItem) =>
            isSkeletonItem(item) ? item.id : keyExtractor(item),
        [keyExtractor],
    )

    const footerComponent = isFetchingNextPage ? (
        <PWView style={styles.footer}>
            <ActivityIndicator />
        </PWView>
    ) : undefined

    return (
        <SearchableList<T | SkeletonItem>
            inBottomSheet={inBottomSheet}
            data={listData}
            renderItem={renderRow}
            keyExtractor={keyExtractorFn}
            searchValue={searchValue}
            searchPlaceholder={searchPlaceholder}
            onSearchChange={onSearchChange}
            autoFocusSearch={autoFocusSearch}
            ListEmptyComponent={showSkeletons ? undefined : ListEmptyComponent}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={footerComponent}
            ItemSeparatorComponent={ItemSeparatorComponent ?? undefined}
            cardLayout={cardLayout}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            keyboardDismissMode='on-drag'
        />
    )
}
