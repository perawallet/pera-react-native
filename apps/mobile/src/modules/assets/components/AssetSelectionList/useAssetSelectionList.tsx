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

import { useCallback, useMemo, type ReactNode } from 'react'
import type { ListRenderItemInfo } from '@shopify/flash-list'

import { PWView } from '@components/core'
import { AssetRowSkeleton } from '@modules/assets/components/AssetRowSkeleton'
import { useStyles } from './styles'

export type SkeletonItem = {
    readonly __assetSkeleton: true
    readonly id: string
}

const isSkeletonItem = (item: unknown): item is SkeletonItem =>
    typeof item === 'object' && item !== null && '__assetSkeleton' in item

export type UseAssetSelectionListProps<T> = {
    data: readonly T[] | null | undefined
    renderItem: (info: ListRenderItemInfo<T>) => ReactNode
    keyExtractor: (item: T) => string
    isLoading: boolean
    skeletonCount: number
}

export type UseAssetSelectionListResult<T> = {
    showSkeletons: boolean
    listData: readonly (T | SkeletonItem)[]
    renderRow: (info: ListRenderItemInfo<T | SkeletonItem>) => ReactNode
    keyExtractorFn: (item: T | SkeletonItem) => string
}

export const useAssetSelectionList = <T,>({
    data,
    renderItem,
    keyExtractor,
    isLoading,
    skeletonCount,
}: UseAssetSelectionListProps<T>): UseAssetSelectionListResult<T> => {
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

    return { showSkeletons, listData, renderRow, keyExtractorFn }
}
