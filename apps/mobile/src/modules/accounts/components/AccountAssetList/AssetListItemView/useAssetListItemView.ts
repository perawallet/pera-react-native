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

import { useMemo } from 'react'
import type { Decimal } from 'decimal.js'
import {
    displayCurrencyToAssetId,
    isCollectible,
} from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    assetFromHoldingLiteRow,
    type AccountHoldingsLiteRow,
} from '@perawallet/wallet-core-accounts'
import { pow10, type Nullable } from '@perawallet/wallet-core-shared'
import type {
    AssetFiatConverter,
    AssetFiatValue,
    CollectibleDisplayItem,
} from '@modules/assets'

export type UseAssetListItemViewProps = {
    holding: AccountHoldingsLiteRow
    chainId: ChainId
    convertFiat: AssetFiatConverter
}

export type UseAssetListItemViewResult = {
    asset: ReturnType<typeof assetFromHoldingLiteRow>
    amount: Decimal
    fiat: AssetFiatValue
    fiatAssetId: Nullable<string>
    collectibleItem: Nullable<CollectibleDisplayItem>
}

export const useAssetListItemView = ({
    holding,
    chainId,
    convertFiat,
}: UseAssetListItemViewProps): UseAssetListItemViewResult => {
    const asset = useMemo(
        () => assetFromHoldingLiteRow(holding, chainId),
        [holding, chainId],
    )

    const amount = useMemo(
        () =>
            asset ? holding.amount.div(pow10(asset.decimals)) : holding.amount,
        [holding.amount, asset],
    )

    const fiat = useMemo(
        () =>
            convertFiat(
                { chainId, assetId: holding.assetId },
                holding.usdPrice,
                amount,
            ),
        [convertFiat, chainId, holding.assetId, holding.usdPrice, amount],
    )

    const collectibleItem = useMemo(() => {
        if (asset && isCollectible(asset)) {
            return {
                assetId: holding.assetId,
                asset,
                collectible: asset.peraMetadata?.collectible,
                amount,
            }
        }
        return null
    }, [asset, holding.assetId, amount])

    return {
        asset,
        amount,
        fiat,
        fiatAssetId: displayCurrencyToAssetId(fiat.displayCurrency, chainId),
        collectibleItem,
    }
}
