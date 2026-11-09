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

import type {
    AssetWithAccountBalance,
    ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import type {
    AssetRef,
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { isSwappableAsset } from '@perawallet/wallet-core-swaps'
import { EmptyView } from '@components/EmptyView'
import { FilterSelection } from '@components/FilterSelection'
import { AccountAssetSelectionList } from '@modules/assets'
import { useSwapFromAssetSelectionList } from './useSwapFromAssetSelectionList'

export type SwapFromAssetSelectionListProps = {
    scope: ChainScope
    excludeAsset?: AssetRef
    onAssetSelected: (asset: ChainAssetBalance) => void
    searchPlaceholder: string
    emptyResultTitle: string
    emptyResultBody: string
    emptyChainResultBody: string
}

const filterSwappable = (item: AssetWithAccountBalance) =>
    isSwappableAsset(item.asset)

export const SwapFromAssetSelectionList = ({
    scope,
    excludeAsset,
    onAssetSelected,
    searchPlaceholder,
    emptyResultTitle,
    emptyResultBody,
    emptyChainResultBody,
}: SwapFromAssetSelectionListProps) => {
    const {
        chainOptions,
        selectedChainId,
        visibleChainIds,
        isChainShown,
        handleSelectChain,
    } = useSwapFromAssetSelectionList(scope)

    return (
        <AccountAssetSelectionList
            chainIds={visibleChainIds}
            onAssetSelected={onAssetSelected}
            isVisible
            excludeAsset={excludeAsset}
            filterAsset={filterSwappable}
            inBottomSheet
            isChainShown={isChainShown}
            searchPlaceholder={searchPlaceholder}
            emptyResultTitle={emptyResultTitle}
            emptyResultBody={emptyResultBody}
            emptyView={
                selectedChainId !== null ? (
                    <EmptyView
                        title={emptyResultTitle}
                        body={emptyChainResultBody}
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
