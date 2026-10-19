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
import { Decimal } from 'decimal.js'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type {
    AssetFiatConverter,
    AssetFiatValue,
} from '../../hooks/useAssetListFiatConverter'
import type {
    AssetGroupItem,
    GroupableHolding,
} from '../../utils/groupedHoldings'

export type UseAssetGroupRowParams<T extends GroupableHolding> = {
    item: AssetGroupItem<T>
    convertFiat: AssetFiatConverter
}

export type UseAssetGroupRowResult = {
    /** Null until the first member's metadata has synced. */
    icon: Nullable<PeraAsset>
    chainIds: ChainId[]
    /** Null value while any member's is unknown. */
    fiat: Nullable<AssetFiatValue>
}

export const useAssetGroupRow = <T extends GroupableHolding>({
    item,
    convertFiat,
}: UseAssetGroupRowParams<T>): UseAssetGroupRowResult => {
    const { members } = item

    const chainIds = useMemo(
        () => members.map(member => member.holding.scope.chainId),
        [members],
    )

    // One unknown member makes the whole value unknown: a partial sum would
    // understate the holding.
    const fiat = useMemo((): Nullable<AssetFiatValue> => {
        let total: Nullable<Decimal> = new Decimal(0)
        let displayCurrency: Nullable<string> = null
        for (const { holding, displayAmount, usdPrice } of members) {
            if (displayAmount === null) return null
            const converted = convertFiat(
                { chainId: holding.scope.chainId, assetId: holding.assetId },
                usdPrice,
                displayAmount,
            )
            displayCurrency ??= converted.displayCurrency
            total =
                total === null ||
                converted.value === null ||
                converted.displayCurrency !== displayCurrency
                    ? null
                    : total.plus(converted.value)
        }
        return displayCurrency === null
            ? null
            : { displayCurrency, value: total }
    }, [members, convertFiat])

    return { icon: members[0]?.asset ?? null, chainIds, fiat }
}
