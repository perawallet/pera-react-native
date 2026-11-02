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

import React from 'react'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWLoadingIndicator, PWView } from '@components/core'
import { SearchableList } from '@components/SearchableList'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useStyles } from './styles'
import {
    useAssetSelectionList,
    type SkeletonItem,
} from './useAssetSelectionList'

export type AssetSelectionListProps<T> = {
    data: readonly T[] | null | undefined
    renderItem: (info: ListRenderItemInfo<T>) => React.ReactNode
    keyExtractor: (item: T) => string

    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
    autoFocusSearch?: boolean
    /** Pinned under the search input, such as filter chips. */
    searchAccessory?: React.ReactNode

    isLoading?: boolean
    skeletonCount?: number
    ListEmptyComponent?: React.ComponentType | React.ReactElement
    ListHeaderComponent?: React.ComponentType | React.ReactElement

    onEndReached?: () => void
    isFetchingNextPage?: boolean

    ItemSeparatorComponent?: Nullable<React.ComponentType>
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
    searchAccessory,
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

    const { showSkeletons, listData, renderRow, keyExtractorFn } =
        useAssetSelectionList({
            data,
            renderItem,
            keyExtractor,
            isLoading,
            skeletonCount,
        })

    const footerComponent = isFetchingNextPage ? (
        <PWView style={styles.footer}>
            <PWLoadingIndicator />
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
            searchAccessory={searchAccessory}
            ListEmptyComponent={showSkeletons ? undefined : ListEmptyComponent}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={footerComponent}
            ItemSeparatorComponent={ItemSeparatorComponent}
            cardLayout={cardLayout}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            keyboardDismissMode='on-drag'
        />
    )
}
