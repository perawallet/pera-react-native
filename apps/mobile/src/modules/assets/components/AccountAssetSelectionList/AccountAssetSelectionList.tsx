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

import { useCallback, type ReactElement } from 'react'
import {
    HoldingRestrictions,
    type AssetWithAccountBalance,
    type ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { EmptyView } from '@components/EmptyView'
import { AssetSelectionList } from '@modules/assets/components'
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
    /** See `useAccountAssetSelectionList`'s `chainId`. */
    chainId?: ChainId
    /** Shown when the list has nothing to offer, no search term is active and the read didn't fail. */
    emptyView?: ReactElement
}

const keyOf = (item: ChainAssetBalance) => item.assetId

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
    chainId,
    emptyView,
}: AccountAssetSelectionListProps) => {
    const styles = useStyles({ hasPadding })
    const {
        filteredBalanceData,
        searchFilter,
        setSearchFilter,
        debouncedSearchFilter,
        isLoading,
        isError,
    } = useAccountAssetSelectionList({
        isVisible,
        excludeAssetId,
        filterAsset,
        chainId,
    })

    const renderItem = useCallback(
        ({ item }: { item: ChainAssetBalance }) => {
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
                    testID={`asset-list-item-${item.assetId}`}
                />
            )
        },
        [onAssetSelected, styles],
    )

    const renderListEmpty = () => {
        if (debouncedSearchFilter) {
            return (
                <EmptyView
                    title={emptyResultTitle}
                    body={emptyResultBody}
                />
            )
        }
        return isError ? undefined : emptyView
    }

    return (
        <AssetSelectionList
            data={filteredBalanceData}
            renderItem={renderItem}
            keyExtractor={keyOf}
            searchValue={searchFilter}
            onSearchChange={setSearchFilter}
            searchPlaceholder={searchPlaceholder}
            isLoading={isLoading}
            skeletonCount={3}
            inBottomSheet={inBottomSheet}
            ListEmptyComponent={renderListEmpty()}
        />
    )
}
