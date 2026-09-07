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

import { useCallback } from 'react'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { AssetSelectionList } from '@modules/assets/components'
import {
    useSwapToAssetSelectionList,
    type AvailableAssetWithBalance,
} from './useSwapToAssetSelectionList'
import { SwapToAssetItemView } from './SwapToAssetItemView'
import { useStyles } from './styles'

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

    const renderItem = useCallback(
        ({ item }: { item: AvailableAssetWithBalance }) => (
            <SwapToAssetItemView
                dexAsset={item.dexAsset}
                balance={item.balance}
                onPress={() => handleAssetSelected(item)}
                style={styles.item}
                testID={`swap-asset-item-${item.dexAsset.assetId}`}
            />
        ),
        [handleAssetSelected, styles],
    )

    return (
        <AssetSelectionList
            data={items}
            renderItem={renderItem}
            keyExtractor={item => item.dexAsset.assetId}
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading && items.length === 0}
            skeletonCount={3}
            cardLayout
            inBottomSheet={inBottomSheet}
            ListEmptyComponent={
                !isLoading && debouncedSearchFilter ? (
                    <EmptyView
                        title={emptyResultTitle}
                        body={emptyResultBody}
                    />
                ) : undefined
            }
        />
    )
}
