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
import type { ChainAssetBalance } from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    AssetRef,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { PWText } from '@components/core'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { AccountAssetItemView, AssetSelectionList } from '@modules/assets'
import { scopedAssetKey } from '@utils/scopedAssetKey'
import { useStyles } from './styles'
import { useSwapFromAssetSelectionList } from './useSwapFromAssetSelectionList'

export type SwapFromAssetSelectionListProps = {
    scope: ChainScope
    excludeAsset?: AssetRef
    onAssetSelected: (holding: ChainAssetBalance) => void
    emptyResultTitle: string
    emptyResultBody: string
    emptyChainResultBody: string
    emptyAccountResultBody: string
}

const keyOf = (holding: ChainAssetBalance) =>
    scopedAssetKey(holding.scope, holding.assetId)

export const SwapFromAssetSelectionList = ({
    scope,
    excludeAsset,
    onAssetSelected,
    emptyResultTitle,
    emptyResultBody,
    emptyChainResultBody,
    emptyAccountResultBody,
}: SwapFromAssetSelectionListProps) => {
    const styles = useStyles()
    const {
        holdings,
        isLoading,
        searchFilter,
        setSearchFilter,
        chainOptions,
        selectedChainId,
        isChainShown,
        handleSelectChain,
        searchPlaceholder,
        networkLabelOf,
        emptyState,
    } = useSwapFromAssetSelectionList(scope, excludeAsset)

    const renderItem = useCallback(
        ({ item }: { item: ChainAssetBalance }) => (
            <AccountAssetItemView
                onPress={() => onAssetSelected(item)}
                style={styles.item}
                accountBalance={item}
                scope={item.scope}
                subtitle={
                    <PWText
                        style={styles.networkLabel}
                        numberOfLines={1}
                    >
                        {networkLabelOf(item.scope.chainId)}
                    </PWText>
                }
                // A restricted holding can't be transferred: it stays listed so
                // the user knows it exists, but can't be picked.
                disabled={item.restriction !== null}
                showFrozenBadge={item.restriction !== null}
                showChainBadge={isChainShown}
                testID={
                    isChainShown
                        ? `asset-list-item-${item.scope.chainId}-${item.assetId}`
                        : `asset-list-item-${item.assetId}`
                }
            />
        ),
        [isChainShown, onAssetSelected, networkLabelOf, styles],
    )

    const emptyBodies = {
        search: emptyResultBody,
        network: emptyChainResultBody,
        account: emptyAccountResultBody,
    }

    return (
        <AssetSelectionList
            data={holdings}
            renderItem={renderItem}
            keyExtractor={keyOf}
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading}
            skeletonCount={3}
            inBottomSheet
            ListEmptyComponent={
                emptyState ? (
                    <EmptyView
                        title={emptyResultTitle}
                        body={emptyBodies[emptyState]}
                    />
                ) : undefined
            }
            searchAccessory={
                chainOptions.length > 0 ? (
                    <FilterSelection<Nullable<ChainId>>
                        options={chainOptions}
                        selectedValue={selectedChainId}
                        onSelect={handleSelectChain}
                        testID='swap_from_chain_filter'
                    />
                ) : undefined
            }
        />
    )
}
