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
import {
    HoldingRestrictions,
    type AssetWithAccountBalance,
    type ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import { EmptyView } from '@components/EmptyView'
import { AssetSelectionList } from '@modules/assets/components'
import { useAssetListFiatConverter } from '../../hooks/useAssetListFiatConverter'
import {
    groupedHoldingItemKey,
    type GroupedHoldingItem,
} from '../../utils/groupedHoldings'
import { AssetGroupRow } from '../AssetGroupRow'
import { ChainLabel } from '../ChainLabel'
import { AccountAssetItemView } from '../AssetItem/AccountAssetItemView'
import { useAccountAssetSelectionList } from './useAccountAssetSelectionList'
import { useStyles } from './styles'

export type AccountAssetSelectionListProps = {
    onAssetSelected: (asset: ChainAssetBalance) => void
    isVisible?: boolean
    inBottomSheet?: boolean
    hasPadding?: boolean
    excludeAssetId?: string
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
    /** See `useAccountAssetSelectionList`'s `isAcrossChains`. */
    isAcrossChains?: boolean
}

export const AccountAssetSelectionList = ({
    onAssetSelected,
    isVisible,
    inBottomSheet,
    hasPadding = true,
    excludeAssetId,
    filterAsset,
    searchPlaceholder,
    emptyResultTitle,
    emptyResultBody,
    isAcrossChains,
}: AccountAssetSelectionListProps) => {
    const styles = useStyles({ hasPadding })
    const {
        items,
        toggleGroupExpanded,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
    } = useAccountAssetSelectionList({
        isVisible,
        excludeAssetId,
        filterAsset,
        isAcrossChains,
    })

    const convertFiat = useAssetListFiatConverter()

    const renderItem = useCallback(
        ({
            item: listItem,
        }: {
            item: GroupedHoldingItem<ChainAssetBalance>
        }) => {
            if (listItem.kind === 'group') {
                return (
                    <AssetGroupRow
                        item={listItem}
                        convertFiat={convertFiat}
                        onToggleExpanded={() =>
                            toggleGroupExpanded(listItem.group.id)
                        }
                        style={styles.item}
                    />
                )
            }
            const { holding: item, isGroupMember } = listItem
            const isTransferBlocked =
                item.restriction === HoldingRestrictions.transferBlocked
            return (
                <AccountAssetItemView
                    onPress={() => onAssetSelected(item)}
                    style={styles.item}
                    accountBalance={item}
                    scope={item.scope}
                    // Every consumer of this list moves funds (send, swap,
                    // card), and a restricted holding can't be transferred —
                    // keep it visible so the user knows it exists, but not
                    // selectable.
                    disabled={isTransferBlocked}
                    showFrozenBadge={isTransferBlocked}
                    subtitle={
                        isGroupMember ? (
                            <ChainLabel chainId={item.scope.chainId} />
                        ) : undefined
                    }
                    testID={`asset-list-item-${item.assetId}`}
                />
            )
        },
        [onAssetSelected, styles, convertFiat, toggleGroupExpanded],
    )

    return (
        <AssetSelectionList
            data={items}
            renderItem={renderItem}
            keyExtractor={groupedHoldingItemKey}
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading}
            skeletonCount={3}
            inBottomSheet={inBottomSheet}
            ListEmptyComponent={
                debouncedSearchFilter ? (
                    <EmptyView
                        title={emptyResultTitle}
                        body={emptyResultBody}
                    />
                ) : undefined
            }
        />
    )
}
