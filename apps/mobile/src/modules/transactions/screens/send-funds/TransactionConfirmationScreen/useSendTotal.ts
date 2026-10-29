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
    isCollectible,
    toWholeUnits,
    useIsNativeAssetId,
    useNativeAsset,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Maybe, Optional } from '@perawallet/wallet-core-shared'
import { resolveSignificantPrecision } from '@components/CurrencyAmount'
import { usePreferredAmount } from '@components/PreferredAmount'

export type SendTotalLine = {
    asset: PeraAsset
    /** Display units of `asset`. */
    amount: Decimal
}

export type UseSendTotalResult = {
    /** One line per asset the send spends; empty until the fee is known. */
    lines: SendTotalLine[]
    /** In the preferred currency; unset until both prices load, and for a collectible. */
    preferredValue: Optional<Decimal>
    isPending: boolean
    /** True while either price behind `preferredValue` is still loading. */
    isPreferredPending: boolean
}

type UseSendTotalInput = {
    scope: ChainScope
    asset: Maybe<PeraAsset>
    /** Display units of `asset`. */
    amount: Optional<Decimal>
    /** Base units of the chain's native asset. */
    feeAmount: Optional<Decimal>
}

export const useSendTotal = ({
    scope,
    asset,
    amount,
    feeAmount,
}: UseSendTotalInput): UseSendTotalResult => {
    const nativeAsset = useNativeAsset(scope)
    const isNativeAssetId = useIsNativeAssetId(scope)

    // Rounded as the fee row shows it, so the total adds up on screen.
    const fee = useMemo(() => {
        if (!feeAmount) return undefined
        const wholeFee = toWholeUnits(feeAmount, nativeAsset)
        return wholeFee.toDecimalPlaces(
            resolveSignificantPrecision(wholeFee, nativeAsset.decimals),
        )
    }, [feeAmount, nativeAsset])

    const isCollectibleAsset = asset ? isCollectible(asset) : false
    const { convertedValue: amountValue, isPending: isAmountPricePending } =
        usePreferredAmount(
            amount,
            asset?.assetId ?? nativeAsset.assetId,
            false,
            undefined,
            scope,
        )
    const { convertedValue: feeValue, isPending: isFeePricePending } =
        usePreferredAmount(fee, nativeAsset.assetId, false, undefined, scope)

    const isPreferredPending = isAmountPricePending || isFeePricePending

    return useMemo(() => {
        if (!asset || !amount || !fee) {
            return {
                lines: [],
                preferredValue: undefined,
                isPending: true,
                isPreferredPending,
            }
        }
        const lines = isNativeAssetId(asset.assetId)
            ? [{ asset, amount: amount.plus(fee) }]
            : [
                  { asset, amount },
                  { asset: nativeAsset, amount: fee },
              ]
        const preferredValue =
            !isCollectibleAsset && amountValue && feeValue
                ? amountValue.plus(feeValue)
                : undefined
        return { lines, preferredValue, isPending: false, isPreferredPending }
    }, [
        asset,
        amount,
        fee,
        isNativeAssetId,
        nativeAsset,
        isCollectibleAsset,
        amountValue,
        feeValue,
        isPreferredPending,
    ])
}
