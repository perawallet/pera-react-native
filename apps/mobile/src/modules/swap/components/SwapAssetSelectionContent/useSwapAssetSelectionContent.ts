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

import { useCallback, useState } from 'react'
import type {
    AccountChainAssetBalance,
    AssetWithAccountBalance,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { trackEvent, SwapEvent, AnalyticsMetadataKey } from '@analytics'
import type { SwapPayHolding } from '@perawallet/wallet-core-swaps'

/** The picked asset, on the scope it lives on. */
export type SwapAssetSelection = {
    assetId: string
    scope: ChainScope
    /** `pay` also comes from Swap To when the user moves the swap onto another network. */
    side: 'pay' | 'receive'
    /** The account to pay from, when the pick named one; unset keeps the selected account. */
    accountId?: string
}

type UseSwapAssetSelectionContentResult = {
    handleAssetSelected: (
        asset: AssetWithAccountBalance,
        assetScope: ChainScope,
    ) => void
    /** The asset held by several accounts, while the user picks which one pays. */
    pendingPayHolding: Nullable<SwapPayHolding>
    handleFromAssetSelected: (holding: SwapPayHolding) => void
    handleSourceAccountSelected: (holder: AccountChainAssetBalance) => void
    handleBackToAssets: () => void
    handleSwitchPayAsset: (assetId: string, payScope: ChainScope) => void
}

const trackAssetPick = (
    variant: 'from' | 'to',
    asset: AssetWithAccountBalance,
    assetScope: ChainScope,
) =>
    trackEvent(
        variant === 'from'
            ? SwapEvent.SelectTopAsset
            : SwapEvent.SelectBottomAsset,
        {
            [AnalyticsMetadataKey.ChainId]: assetScope.chainId,
            [AnalyticsMetadataKey.AssetName]:
                asset.asset?.unitName ?? asset.asset?.name ?? asset.assetId,
        },
    )

export const useSwapAssetSelectionContent = (
    variant: 'from' | 'to',
): UseSwapAssetSelectionContentResult => {
    const { resolve } = useBottomSheetResult<SwapAssetSelection>()
    const [pendingPayHolding, setPendingPayHolding] =
        useState<Nullable<SwapPayHolding>>(null)

    const handleAssetSelected = useCallback(
        (asset: AssetWithAccountBalance, assetScope: ChainScope) => {
            trackAssetPick(variant, asset, assetScope)
            resolve({
                assetId: asset.assetId,
                scope: assetScope,
                side: variant === 'from' ? 'pay' : 'receive',
            })
        },
        [resolve, variant],
    )

    const handleSourceAccountSelected = useCallback(
        (holder: AccountChainAssetBalance) =>
            resolve({
                assetId: holder.assetId,
                scope: holder.scope,
                side: 'pay',
                accountId: holder.accountId,
            }),
        [resolve],
    )

    const handleFromAssetSelected = useCallback(
        (holding: SwapPayHolding) => {
            trackAssetPick('from', holding, holding.scope)
            const [onlyHolder, ...others] = holding.holders
            if (others.length > 0) {
                setPendingPayHolding(holding)
                return
            }
            handleSourceAccountSelected(onlyHolder)
        },
        [handleSourceAccountSelected],
    )

    const handleBackToAssets = useCallback(() => setPendingPayHolding(null), [])

    const handleSwitchPayAsset = useCallback(
        (assetId: string, payScope: ChainScope) =>
            resolve({ assetId, scope: payScope, side: 'pay' }),
        [resolve],
    )

    return {
        handleAssetSelected,
        pendingPayHolding,
        handleFromAssetSelected,
        handleSourceAccountSelected,
        handleBackToAssets,
        handleSwitchPayAsset,
    }
}
