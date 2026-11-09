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
import type {
    AssetWithAccountBalance,
    ChainAssetBalance,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'

/** The picked asset, on the scope it lives on. */
export type SwapAssetSelection = {
    assetId: string
    scope: ChainScope
    /** `pay` also comes from Swap To when the user moves the swap onto another network. */
    side: 'pay' | 'receive'
}

type UseSwapAssetSelectionContentResult = {
    handleAssetSelected: (
        asset: AssetWithAccountBalance,
        assetScope: ChainScope,
    ) => void
    handleFromAssetSelected: (asset: ChainAssetBalance) => void
    handleSwitchPayAsset: (assetId: string, payScope: ChainScope) => void
}

export const useSwapAssetSelectionContent = (
    variant: 'from' | 'to',
): UseSwapAssetSelectionContentResult => {
    const { resolve } = useBottomSheetResult<SwapAssetSelection>()

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance, assetScope: ChainScope) => {
            const assetName =
                asset.asset?.unitName ?? asset.asset?.name ?? asset.assetId
            trackEvent(
                variant === 'from'
                    ? SwapEvent.SelectTopAsset
                    : SwapEvent.SelectBottomAsset,
                {
                    [AnalyticsMetadataKey.ChainId]: assetScope.chainId,
                    [AnalyticsMetadataKey.AssetName]: assetName,
                },
            )
            resolve({
                assetId: asset.assetId,
                scope: assetScope,
                side: variant === 'from' ? 'pay' : 'receive',
            })
        },
        [resolve, variant],
    )

    const handleFromAssetSelected = useCallback(
        (asset: ChainAssetBalance) => handleAssetSelected(asset, asset.scope),
        [handleAssetSelected],
    )

    const handleSwitchPayAsset = useCallback(
        (assetId: string, payScope: ChainScope) =>
            resolve({ assetId, scope: payScope, side: 'pay' }),
        [resolve],
    )

    return {
        handleAssetSelected,
        handleFromAssetSelected,
        handleSwitchPayAsset,
    }
}
