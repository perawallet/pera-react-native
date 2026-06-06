/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import { Decimal } from 'decimal.js'
import {
    useCurrency,
    usePreferredCurrencyPriceQuery,
} from '@perawallet/wallet-core-currencies'
import { ALGO_ASSET, ALGO_ASSET_ID } from '@perawallet/wallet-core-assets'
import type { Maybe, Nullable } from '@perawallet/wallet-core-shared'

export type AssetFiatValue = {
    displayCurrency: string
    value: Nullable<Decimal>
}

export type AssetFiatConverter = (
    assetId: string,
    usdPrice: Maybe<Decimal>,
    amountDisplayUnits: Decimal,
) => AssetFiatValue

/**
 * Returns a stable function that converts a single holding to the preferred
 * currency. The exchange rates are read **once** here at the list level (no
 * per-row React Query observers), and visible rows call the returned function
 * during render — so the conversion is done only for the ~handful of on-screen
 * rows, not all N holdings on every data change. Mirrors
 * `usePreferredCurrencyDisplay`'s conversion exactly so the result is
 * identical to the shared display component.
 */
export const useAssetListFiatConverter = (): AssetFiatConverter => {
    const { preferredCurrency, fallbackCurrency, usdToPreferred } = useCurrency()
    const isPreferredAlgo = preferredCurrency === ALGO_ASSET.unitName

    // ALGO-denominated holdings can't price in ALGO, so they fall back to the
    // fiat currency — only fetch that rate when the preferred currency is ALGO.
    const { data: fallbackRate } = usePreferredCurrencyPriceQuery(
        fallbackCurrency,
        isPreferredAlgo,
    )

    return useCallback(
        (assetId, usdPrice, amountDisplayUnits) => {
            if (usdPrice == null) {
                return { displayCurrency: preferredCurrency, value: null }
            }

            const isSourceAlgo = assetId === ALGO_ASSET_ID
            const needsFallback = isPreferredAlgo && isSourceAlgo
            const usdValue = amountDisplayUnits.mul(usdPrice)
            const value = needsFallback
                ? usdValue.mul(fallbackRate?.usdPrice ?? new Decimal(0))
                : usdToPreferred(usdValue)

            return {
                displayCurrency: needsFallback
                    ? fallbackCurrency
                    : preferredCurrency,
                value,
            }
        },
        [
            preferredCurrency,
            fallbackCurrency,
            usdToPreferred,
            isPreferredAlgo,
            fallbackRate,
        ],
    )
}
