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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    useCurrency,
    usePreferredCurrencyPriceQuery,
} from '@perawallet/wallet-core-currencies'
import {
    useAssetPricesQuery,
    ALGO_ASSET_ID,
    ALGO_ASSET,
} from '@perawallet/wallet-core-assets'

type UsePreferredCurrencyDisplayResult = {
    displayCurrency: string
    convertedValue: Decimal | null
    isPending: boolean
}

export const usePreferredCurrencyDisplay = (
    sourceAmount: Decimal | null | undefined,
    sourceAssetId: string,
    forceFallback?: boolean,
    preFetchedUsdPrice?: Decimal,
): UsePreferredCurrencyDisplayResult => {
    const { preferredCurrency, fallbackCurrency, usdToPreferred } =
        useCurrency()
    const isPreferredAlgo = preferredCurrency === ALGO_ASSET.unitName
    const isSourceAlgo = sourceAssetId === ALGO_ASSET_ID

    const needsFallback = forceFallback || (isPreferredAlgo && isSourceAlgo)

    const displayCurrency = useMemo(() => {
        if (needsFallback) return fallbackCurrency
        return preferredCurrency
    }, [needsFallback, fallbackCurrency, preferredCurrency])

    // Skip per-item price fetch when a pre-fetched price is provided (bulk query optimization)
    const priceIDs = useMemo(
        () => (preFetchedUsdPrice !== null ? [] : [sourceAssetId]),
        [preFetchedUsdPrice, sourceAssetId],
    )
    const { data: usdPrices, isPending: usdPricesPending } =
        useAssetPricesQuery(priceIDs)

    // Fallback exchange rate (needed when displaying in fallback currency)
    const { data: fallbackRate, isPending: fallbackRatePending } =
        usePreferredCurrencyPriceQuery(fallbackCurrency, needsFallback)

    const isPending = useMemo(() => {
        if (preFetchedUsdPrice !== null) {
            return needsFallback ? fallbackRatePending : false
        }
        if (needsFallback) {
            return usdPricesPending || fallbackRatePending
        }
        return usdPricesPending
    }, [
        preFetchedUsdPrice,
        needsFallback,
        fallbackRatePending,
        usdPricesPending,
    ])

    const convertedValue = useMemo(() => {
        if (!sourceAmount) return null
        if (isPending) return null

        const resolvedUsdPrice =
            preFetchedUsdPrice ??
            usdPrices?.get(sourceAssetId)?.usdPrice ??
            Decimal(0)
        const usdValue = sourceAmount.mul(resolvedUsdPrice)

        if (!needsFallback) {
            return usdToPreferred(usdValue)
        }

        const rate = fallbackRate?.usdPrice ?? Decimal(0)
        return usdValue.mul(rate)
    }, [
        sourceAmount,
        isPending,
        needsFallback,
        preFetchedUsdPrice,
        usdPrices,
        sourceAssetId,
        usdToPreferred,
        fallbackRate,
    ])

    return { displayCurrency, convertedValue, isPending }
}
