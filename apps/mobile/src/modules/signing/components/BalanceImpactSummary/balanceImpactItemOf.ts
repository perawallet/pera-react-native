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

import { Decimal } from 'decimal.js'
import {
    isUniqueCollectible,
    PeraAssetType,
    type DisplayableAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import {
    baseUnitsToDisplayUnits,
    type Optional,
} from '@perawallet/wallet-core-shared'
import type { BalanceImpactItem } from './useBalanceImpactSummary'

type BalanceImpactItemParams = {
    assetId: string
    chainId: ChainId
    /** Absent while its record is unread; the row then shows the id as the unit. */
    asset: Optional<PeraAsset>
    /** Signed base units of the asset: positive is received, negative or zero is spent. */
    baseUnits: Decimal | bigint
    usdPrice?: Decimal
    isFullBalance?: boolean
}

export const balanceImpactItemOf = ({
    assetId,
    chainId,
    asset,
    baseUnits,
    usdPrice,
    isFullBalance = false,
}: BalanceImpactItemParams): BalanceImpactItem => {
    const signed = new Decimal(baseUnits.toString())
    const isCollectible =
        asset?.peraMetadata?.type === PeraAssetType.collectible
    // Without metadata, still render with the id as the unit so the row
    // isn't blank while the asset syncs.
    const displayAsset: DisplayableAsset = asset ?? {
        assetId,
        unitName: assetId,
    }
    const collectible = asset?.peraMetadata?.collectible

    return {
        assetId,
        chainId,
        asset: displayAsset,
        isCollectible,
        isPureCollectible:
            isCollectible && !!asset && isUniqueCollectible(asset),
        direction: signed.gt(0) ? 'receive' : 'spend',
        amount: baseUnitsToDisplayUnits(signed.abs(), asset?.decimals ?? 0),
        isFullBalance,
        isNewAsset: false,
        usdPrice,
        collectibleTitle: isCollectible
            ? (collectible?.title ?? asset?.name ?? `#${assetId}`)
            : undefined,
        collectibleSubtitle: isCollectible
            ? [collectible?.collection?.name, assetId]
                  .filter(Boolean)
                  .join(' · ')
            : undefined,
    }
}
