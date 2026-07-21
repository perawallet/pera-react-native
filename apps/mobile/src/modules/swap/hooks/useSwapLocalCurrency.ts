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

import { useCallback, useMemo } from 'react'
import { Decimal } from 'decimal.js'
import { useSwaps } from '@perawallet/wallet-core-swaps'
import {
    useCurrency,
    useCurrenciesQuery,
    usePreferredCurrencyPriceQuery,
} from '@perawallet/wallet-core-currencies'
import {
    useAssetPricesQuery,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { isAlgoAssetName, type Nullable } from '@perawallet/wallet-core-shared'

const FIAT_DECIMAL_PLACES = 2

type UseSwapLocalCurrencyResult = {
    isLocalCurrencyInput: boolean
    localCurrency: string
    localCurrencySymbol: string
    isReady: boolean
    fiatToAsset: (fiat: Nullable<Decimal>) => Nullable<Decimal>
    assetToFiat: (asset: Nullable<Decimal>) => Nullable<Decimal>
}

const fiatToAssetAmount = (
    fiat: Decimal,
    assetUsdPrice: Decimal,
    localRate: Decimal,
    assetDecimals: number,
): Nullable<Decimal> => {
    const denominator = assetUsdPrice.mul(localRate)
    if (denominator.isZero()) return null
    return fiat
        .div(denominator)
        .toDecimalPlaces(assetDecimals, Decimal.ROUND_DOWN)
}

const assetToFiatAmount = (
    asset: Decimal,
    assetUsdPrice: Decimal,
    localRate: Decimal,
): Decimal =>
    asset
        .mul(assetUsdPrice)
        .mul(localRate)
        .toDecimalPlaces(FIAT_DECIMAL_PLACES, Decimal.ROUND_DOWN)

const areRatesUsable = (
    assetUsdPrice: Nullable<Decimal>,
    localRate: Nullable<Decimal>,
    assetDecimals: Nullable<number>,
): boolean =>
    assetUsdPrice !== null &&
    assetUsdPrice.greaterThan(0) &&
    localRate !== null &&
    localRate.greaterThan(0) &&
    assetDecimals !== null

type LocalCurrency = {
    localCurrency: string
    localCurrencySymbol: string
    localRate: Nullable<Decimal>
}

/**
 * Resolves the user's local fiat currency for the swap flow and the USD→fiat
 * rate used by the conversions. The local currency is the app's preferred
 * currency when that is a fiat, or the fallback fiat (USD) when the app
 * currency is ALGO.
 */
const useLocalCurrency = (): LocalCurrency => {
    const { preferredCurrency, fallbackCurrency, usdToPreferred } =
        useCurrency()

    const isAlgoPreferred = isAlgoAssetName(preferredCurrency)
    const localCurrency = isAlgoPreferred ? fallbackCurrency : preferredCurrency

    const { data: currencies } = useCurrenciesQuery()
    const localCurrencySymbol = useMemo(
        () =>
            currencies?.find(currency => currency.id === localCurrency)
                ?.symbol ?? localCurrency,
        [currencies, localCurrency],
    )

    const { data: fallbackRate } = usePreferredCurrencyPriceQuery(
        fallbackCurrency,
        isAlgoPreferred,
    )
    const localRate = useMemo<Nullable<Decimal>>(() => {
        if (isAlgoPreferred) return fallbackRate?.usdPrice ?? null
        return usdToPreferred(new Decimal(1))
    }, [isAlgoPreferred, fallbackRate, usdToPreferred])

    return { localCurrency, localCurrencySymbol, localRate }
}

type AssetUsdRate = {
    assetUsdPrice: Nullable<Decimal>
    assetDecimals: Nullable<number>
}

const useAssetUsdRate = (assetId: string): AssetUsdRate => {
    const { data: assetPrices } = useAssetPricesQuery(
        [assetId],
        Boolean(assetId),
    )
    const { data: assets } = useAssetsQuery([assetId])

    return {
        assetUsdPrice: assetPrices?.get(assetId)?.usdPrice ?? null,
        assetDecimals: assets?.get(assetId)?.decimals ?? null,
    }
}

/**
 * Resolves the user's local fiat currency for the swap flow and the
 * fiat↔asset conversions used by the "use local currency" input mode.
 *
 * All conversions reuse the live asset USD price and the USD→fiat rate — the
 * inverse of the forward math in `usePreferredAmount`.
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
