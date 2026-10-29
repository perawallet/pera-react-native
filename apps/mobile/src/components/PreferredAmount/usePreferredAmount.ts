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
    useCurrency,
    usePreferredCurrencyPriceQuery,
} from '@perawallet/wallet-core-currencies'
import {
    useIsNativeAssetId,
    useAssetPricesQuery,
} from '@perawallet/wallet-core-assets'
import {
    LEGACY_CHAIN_ID,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    isAlgoAssetName,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { useSelectedScope } from '@perawallet/wallet-core-chain-shared'

type UsePreferredAmountResult = {
    displayCurrency: string
    convertedValue: Nullable<Decimal>
    isPending: boolean
}

export const usePreferredAmount = (
    sourceAmount: Maybe<Decimal>,
    sourceAssetId: string,
    forceFallback?: boolean,
    preFetchedUsdPrice?: Decimal,
    scope?: ChainScope,
): UsePreferredAmountResult => {
    const currencyScope = useSelectedScope(LEGACY_CHAIN_ID)
    const assetScope = scope ?? currencyScope
    const { preferredCurrency, fallbackCurrency, usdToPreferred } =
        useCurrency(currencyScope)
    const isAlgoAssetId = useIsNativeAssetId(currencyScope)
    const isPreferredAlgo = isAlgoAssetName(preferredCurrency)
    // Every chain's native asset shares an id shape, so ETH's 'native' would pass the id check alone.
    const isSourceAlgo =
        assetScope.chainId === currencyScope.chainId &&
        isAlgoAssetId(sourceAssetId)

    const needsFallback = forceFallback || (isPreferredAlgo && isSourceAlgo)

    const displayCurrency = useMemo(() => {
        if (needsFallback) return fallbackCurrency
        return preferredCurrency
    }, [needsFallback, fallbackCurrency, preferredCurrency])

    // Skip per-item price fetch when a pre-fetched price is provided (bulk query optimization)
    const hasPreFetchedUsdPrice = preFetchedUsdPrice !== undefined
    const priceIDs = useMemo(
        () => (hasPreFetchedUsdPrice ? [] : [sourceAssetId]),
        [hasPreFetchedUsdPrice, sourceAssetId],
    )
    const { data: usdPrices, isPending: usdPricesPending } =
        useAssetPricesQuery(assetScope, priceIDs, !hasPreFetchedUsdPrice)

    // Fallback exchange rate (needed when displaying in fallback currency)
    const { data: fallbackRate, isPending: fallbackRatePending } =
        usePreferredCurrencyPriceQuery(fallbackCurrency, needsFallback)

    const isPending = useMemo(() => {
        if (preFetchedUsdPrice !== undefined) {
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

        // No price row means the price is unknown, not zero: a priced asset
        // whose fetch failed must not read as worthless.
        const resolvedUsdPrice =
            preFetchedUsdPrice ?? usdPrices?.get(sourceAssetId)?.usdPrice
        if (resolvedUsdPrice == null) return null
        const usdValue = sourceAmount.mul(resolvedUsdPrice)

        if (!needsFallback) {
            return usdToPreferred(usdValue)
        }

        return fallbackRate?.usdPrice?.mul(usdValue) ?? null
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
