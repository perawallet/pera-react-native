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
import { FIAT_DECIMAL_PLACES } from './constants'

import type { Nullable } from '@perawallet/wallet-core-shared'

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
