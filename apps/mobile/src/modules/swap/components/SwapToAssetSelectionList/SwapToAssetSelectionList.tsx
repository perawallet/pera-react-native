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
    type ChainId,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { scopeOfSwapAsset } from '@perawallet/wallet-core-swaps'
import { PWButton } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { AssetSelectionList } from '@modules/assets'
import { scopedAssetKey } from '@utils/scopedAssetKey'
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
    onSwitchPayAsset: (assetId: string, scope: ChainScope) => void
    emptyResultTitle: string
    emptyResultBody: string
    emptyChainResultBody: string
    inBottomSheet?: boolean
}

export const SwapToAssetSelectionList = ({
    scope,
    fromAssetId,
    onAssetSelected,
    isVisible,
    excludeAssetId,
    onSwitchPayAsset,
    emptyResultTitle,
    emptyResultBody,
    emptyChainResultBody,
    inBottomSheet,
}: SwapToAssetSelectionListProps) => {
    const styles = useStyles()
    const {
        items,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        chainOptions,
        selectedChainId,
        handleSelectChain,
        isChainShown,
        isLoading,
        handleEndReached,
        handleAssetSelected,
        searchPlaceholder,
        crossNetworkEmptyState,
        handleSwapOnSelectedNetwork,
    } = useSwapToAssetSelectionList({
        scope,
        fromAssetId,
        isVisible,
        excludeAssetId,
        onAssetSelected,
        onSwitchPayAsset,
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
                    isChainShown={isChainShown}
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
        [handleAssetSelected, isChainShown, scope, styles],
    )

    const renderEmptyView = () => {
        if (crossNetworkEmptyState) {
            return (
                <EmptyView
                    title={crossNetworkEmptyState.title}
                    body={crossNetworkEmptyState.body}
                    shouldTruncateBody={false}
                    testID='swap_to_cross_network_empty'
                    button={
                        crossNetworkEmptyState.actionLabel ? (
                            <PWButton
                                variant='primary'
                                title={crossNetworkEmptyState.actionLabel}
                                onPress={handleSwapOnSelectedNetwork}
                                testID='swap_to_switch_network_button'
                            />
                        ) : undefined
                    }
                />
            )
        }
        if (isLoading || (!debouncedSearchFilter && selectedChainId === null)) {
            return undefined
        }
        return (
            <EmptyView
                title={emptyResultTitle}
                body={
                    debouncedSearchFilter
                        ? emptyResultBody
                        : emptyChainResultBody
                }
            />
        )
    }

    return (
        <AssetSelectionList
            data={items}
            renderItem={renderItem}
            keyExtractor={item =>
                scopedAssetKey(item.swapAsset.ref, item.swapAsset.assetId)
            }
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            searchAccessory={
                chainOptions.length > 0 ? (
                    <FilterSelection<Nullable<ChainId>>
                        options={chainOptions}
                        selectedValue={selectedChainId}
                        onSelect={handleSelectChain}
                        testID='swap_to_chain_filter'
                    />
                ) : undefined
            }
            isLoading={isLoading && items.length === 0}
            onEndReached={handleEndReached}
            skeletonCount={3}
            cardLayout
            inBottomSheet={inBottomSheet}
            ListEmptyComponent={renderEmptyView()}
        />
    )
}
