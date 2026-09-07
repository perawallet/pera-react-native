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
import { AccountAssetItemView } from '../AssetItem/AccountAssetItemView'
import { useAccountAssetSelectionList } from './useAccountAssetSelectionList'
import { useStyles } from './styles'

export type AccountAssetSelectionListProps = {
    onAssetSelected: (asset: AssetWithAccountBalance) => void
    isVisible?: boolean
    inBottomSheet?: boolean
    hasPadding?: boolean
    excludeAssetId?: string
    filterAsset?: (asset: AssetWithAccountBalance) => boolean
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
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
}: AccountAssetSelectionListProps) => {
    const styles = useStyles({ hasPadding })
    const {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
    } = useAccountAssetSelectionList({ isVisible, excludeAssetId, filterAsset })

    const renderItem = useCallback(
        ({ item }: { item: AssetWithAccountBalance }) => (
            <AccountAssetItemView
                onPress={() => onAssetSelected(item)}
                style={styles.item}
                accountBalance={item}
                // Every consumer of this list moves funds (send, swap, card),
                // and a frozen holding can't be transferred — keep it visible
                // so the user knows it exists, but not selectable.
                disabled={item.isFrozen}
                showFrozenBadge={item.isFrozen}
                testID={`asset-list-item-${item.assetId}`}
            />
        ),
        [onAssetSelected, styles],
    )

    return (
        <AssetSelectionList
            data={filteredBalanceData}
            renderItem={renderItem}
            keyExtractor={item => item.assetId}
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
