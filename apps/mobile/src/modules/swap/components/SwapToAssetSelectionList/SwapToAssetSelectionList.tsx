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
import {
    toScopeKey,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { scopeOfSwapAsset } from '@perawallet/wallet-core-swaps'
import { EmptyView } from '@components/EmptyView'
import { AssetSelectionList } from '@modules/assets'
import {
    useSwapToAssetSelectionList,
    type AvailableAssetWithBalance,
} from './useSwapToAssetSelectionList'
import { SwapToAssetItemView } from './SwapToAssetItemView'
import { useStyles } from './styles'

export type SwapToAssetSelectionListProps = {
    scope: ChainScope
    fromAssetId: string
    onAssetSelected: (asset: AssetWithAccountBalance, scope: ChainScope) => void
    isVisible?: boolean
    excludeAssetId?: string
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
    inBottomSheet?: boolean
}

export const SwapToAssetSelectionList = ({
    scope,
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
        handleEndReached,
        handleAssetSelected,
    } = useSwapToAssetSelectionList({
        scope,
        fromAssetId,
        isVisible,
        excludeAssetId,
        onAssetSelected,
    })

    const renderItem = useCallback(
        ({ item }: { item: AvailableAssetWithBalance }) => {
            const { ref } = item.swapAsset
            const isOnScope = toScopeKey(ref) === toScopeKey(scope)
            return (
                <SwapToAssetItemView
                    swapAsset={item.swapAsset}
                    balance={item.balance}
                    scope={scopeOfSwapAsset(ref)}
                    isChainShown={!isOnScope}
                    onPress={() => handleAssetSelected(item)}
                    style={styles.item}
                    testID={
                        isOnScope
                            ? `swap-asset-item-${item.swapAsset.assetId}`
                            : `swap-asset-item-${ref.chainId}-${item.swapAsset.assetId}`
                    }
                />
            )
        },
        [handleAssetSelected, scope, styles],
    )

    return (
        <AssetSelectionList
            data={items}
            renderItem={renderItem}
            // Ids repeat across chains: every EVM chain's native asset is 'native'.
            keyExtractor={item =>
                `${toScopeKey(item.swapAsset.ref)}/${item.swapAsset.assetId}`
            }
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading && items.length === 0}
            onEndReached={handleEndReached}
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
