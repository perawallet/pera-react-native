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

import { useCallback } from 'react'
import { useTheme } from '@rneui/themed'
import { type AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { PWFlatList, PWSkeleton, PWView } from '@components/core'
import { SearchInput } from '@components/SearchInput'
import { EmptyView } from '@components/EmptyView'
import {
    useSwapToAssetSelectionList,
    type AvailableAssetWithBalance,
} from './useSwapToAssetSelectionList'
import { SwapToAssetItemView } from './SwapToAssetItemView'
import { useStyles } from './styles'

type SkeletonItem = { _skeleton: true; id: string }

const SKELETON_ITEMS: SkeletonItem[] = [
    { _skeleton: true, id: 'skeleton-0' },
    { _skeleton: true, id: 'skeleton-1' },
    { _skeleton: true, id: 'skeleton-2' },
]

const isSkeletonItem = (
    item: AvailableAssetWithBalance | SkeletonItem,
): item is SkeletonItem => '_skeleton' in item

export type SwapToAssetSelectionListProps = {
    fromAssetId: string
    onAssetSelected: (asset: AssetWithAccountBalance) => void
    isVisible?: boolean
    excludeAssetId?: string
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
    inBottomSheet?: boolean
}

export const SwapToAssetSelectionList = ({
    fromAssetId,
    onAssetSelected,
    isVisible,
    excludeAssetId,
    searchPlaceholder,
    emptyResultTitle,
    emptyResultBody,
    inBottomSheet,
}: SwapToAssetSelectionListProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const {
        items,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
        handleAssetSelected,
    } = useSwapToAssetSelectionList({
        fromAssetId,
        isVisible,
        excludeAssetId,
        onAssetSelected,
    })

    const listData = isLoading && items.length === 0 ? SKELETON_ITEMS : items

    const renderItem = useCallback(
        ({ item }: { item: AvailableAssetWithBalance | SkeletonItem }) => {
            if (isSkeletonItem(item)) {
                return (
                    <PWView style={[styles.skeletonRow, styles.item]}>
                        <PWSkeleton
                            circle
                            height={theme.spacing.xxl}
                            width={theme.spacing.xxl}
                        />
                        <PWView style={styles.skeletonData}>
                            <PWSkeleton height={14} />
                            <PWSkeleton height={12} />
                        </PWView>
                    </PWView>
                )
            }
            return (
                <SwapToAssetItemView
                    dexAsset={item.dexAsset}
                    balance={item.balance}
                    onPress={() => handleAssetSelected(item)}
                    style={styles.item}
                />
            )
        },
        [handleAssetSelected, styles, theme],
    )

    return (
        <>
            <PWView style={styles.searchContainer}>
                <SearchInput
                    placeholder={searchPlaceholder}
                    value={searchFilter}
                    onChangeText={setSearchFilter}
                />
            </PWView>
            <PWFlatList
                data={listData}
                renderItem={renderItem}
                cardLayout
                inBottomSheet={inBottomSheet}
                keyExtractor={item =>
                    isSkeletonItem(item) ? item.id : item.dexAsset.assetId
                }
                ListEmptyComponent={
                    !isLoading && debouncedSearchFilter ? (
                        <EmptyView
                            title={emptyResultTitle}
                            body={emptyResultBody}
                        />
                    ) : undefined
                }
            />
        </>
    )
}
