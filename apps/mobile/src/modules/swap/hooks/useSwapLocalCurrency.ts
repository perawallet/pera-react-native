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
import { useSwaps } from '@perawallet/wallet-core-swaps'
import {
    areRatesUsable,
    assetToFiatAmount,
    fiatToAssetAmount,
    useLocalCurrency,
} from '@perawallet/wallet-core-currencies'
import { useAssetUsdRate } from '@perawallet/wallet-core-assets'

import type { Decimal } from 'decimal.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseSwapLocalCurrencyResult = {
    isLocalCurrencyInput: boolean
    localCurrency: string
    localCurrencySymbol: string
    isReady: boolean
    fiatToAsset: (fiat: Nullable<Decimal>) => Nullable<Decimal>
    assetToFiat: (asset: Nullable<Decimal>) => Nullable<Decimal>
}

/**
 * Local-currency input mode for the swap flow: the user's local fiat and the
 * fiat↔asset conversions for the pay asset, plus the swap-scoped input-mode
 * flag. Conversions return null until both rates are loaded (`isReady`).
 */
export const useSwapLocalCurrency = (
    assetId: string,
): UseSwapLocalCurrencyResult => {
    const { isLocalCurrencyInput } = useSwaps()
    const { localCurrency, localCurrencySymbol, localRate } = useLocalCurrency()
    const { assetUsdPrice, assetDecimals } = useAssetUsdRate(assetId)

    const isReady = areRatesUsable(assetUsdPrice, localRate, assetDecimals)

    const fiatToAsset = useCallback(
        (fiat: Nullable<Decimal>): Nullable<Decimal> => {
            if (
                !fiat ||
                assetUsdPrice === null ||
                localRate === null ||
                assetDecimals === null
            ) {
                return null
            }
            return fiatToAssetAmount(
                fiat,
                assetUsdPrice,
                localRate,
                assetDecimals,
            )
        },
        [assetUsdPrice, localRate, assetDecimals],
    )

    const assetToFiat = useCallback(
        (asset: Nullable<Decimal>): Nullable<Decimal> => {
            if (!asset || assetUsdPrice === null || localRate === null) {
                return null
            }
            return assetToFiatAmount(asset, assetUsdPrice, localRate)
        },
        [assetUsdPrice, localRate],
    )

    return {
        isLocalCurrencyInput,
        localCurrency,
        localCurrencySymbol,
        isReady,
        fiatToAsset,
        assetToFiat,
    }
}
