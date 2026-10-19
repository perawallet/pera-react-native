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
    ALGO_ASSET_NAME,
    isAlgoAssetName,
    type Nullable,
} from '@perawallet/wallet-core-shared'
import { FIAT_DECIMAL_PLACES, USD_CURRENCY_ID } from './constants'
import type { CurrencyPreference } from './models'

/**
 * Converts a fiat amount to an asset amount via the asset's USD price and the
 * USD→fiat rate, floored to the asset's decimals. Null when either rate is
 * zero (prices still loading) — the division has no meaningful result.
 */
export const fiatToAssetAmount = (
    fiat: Decimal,
    assetUsdPrice: Decimal,
    fiatRate: Decimal,
    assetDecimals: number,
): Nullable<Decimal> => {
    const denominator = assetUsdPrice.mul(fiatRate)
    if (denominator.isZero()) return null
    return fiat
        .div(denominator)
        .toDecimalPlaces(assetDecimals, Decimal.ROUND_DOWN)
}

/**
 * Converts an asset amount to fiat via the asset's USD price and the USD→fiat
 * rate, floored to {@link FIAT_DECIMAL_PLACES}.
 */
export const assetToFiatAmount = (
    asset: Decimal,
    assetUsdPrice: Decimal,
    fiatRate: Decimal,
): Decimal =>
    asset
        .mul(assetUsdPrice)
        .mul(fiatRate)
        .toDecimalPlaces(FIAT_DECIMAL_PLACES, Decimal.ROUND_DOWN)

/**
 * True when both rates are loaded and positive and the asset's decimals are
 * known — i.e. the fiat↔asset conversions above will produce usable results.
 */
export const areRatesUsable = (
    assetUsdPrice: Nullable<Decimal>,
    fiatRate: Nullable<Decimal>,
    assetDecimals: Nullable<number>,
): boolean =>
    assetUsdPrice !== null &&
    assetUsdPrice.greaterThan(0) &&
    fiatRate !== null &&
    fiatRate.greaterThan(0) &&
    assetDecimals !== null

/**
 * A preference whose preferred currency is a fiat: ALGO moves to the fiat
 * fallback, or USD when the fallback is not a fiat, and ALGO becomes the
 * fallback.
 */
export const toFiatCurrencyPreference = (
    preference: CurrencyPreference,
): CurrencyPreference => {
    // ALGO is the only non-fiat ever offered as a preference, so it is the only one checked.
    if (!isAlgoAssetName(preference.preferredCurrency)) return preference

    const { fallbackCurrency } = preference
    const isFiatFallback =
        fallbackCurrency.length > 0 && !isAlgoAssetName(fallbackCurrency)
    return {
        preferredCurrency: isFiatFallback ? fallbackCurrency : USD_CURRENCY_ID,
        fallbackCurrency: ALGO_ASSET_NAME,
    }
}
