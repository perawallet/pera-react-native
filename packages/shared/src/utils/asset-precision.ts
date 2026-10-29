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
import { ASSET_MAX_PRECISION } from '../models/constants'

/** At or above this, an amount keeps {@link LARGE_AMOUNT_PRECISION} decimals. */
const LARGE_AMOUNT_THRESHOLD = 1000
const LARGE_AMOUNT_PRECISION = 4
const MIN_SIGNIFICANT_DIGITS = 2

/**
 * Decimals to display an asset amount with. An asset with up to
 * {@link ASSET_MAX_PRECISION} decimals (ALGO and most ASAs) shows them all.
 * Above that (ETH, ERC-20s): 4 decimals from 1,000 up, else 6 decimals,
 * extended so a small amount keeps 2 significant digits (0.0000085, not
 * 0.000008), never past `decimals`.
 */
export const resolveAssetDisplayPrecision = (
    amount: Decimal | null | undefined,
    decimals: number,
): number => {
    if (decimals <= ASSET_MAX_PRECISION) {
        return decimals
    }
    if (amount == null || amount.isZero()) {
        return ASSET_MAX_PRECISION
    }
    if (amount.abs().gte(LARGE_AMOUNT_THRESHOLD)) {
        return LARGE_AMOUNT_PRECISION
    }
    // `Decimal.e` is the first significant digit's base-10 exponent
    // (0.0000085 → -6), so its place is `-e` and the next digit's is `1 - e`.
    const significantPlaces = MIN_SIGNIFICANT_DIGITS - 1 - amount.e
    return Math.min(decimals, Math.max(ASSET_MAX_PRECISION, significantPlaces))
}

/**
 * An asset amount rounded for display: down (toward zero), so a balance or MAX
 * never reads as more than the account holds, to
 * {@link resolveAssetDisplayPrecision} decimals.
 */
export const roundAssetAmountForDisplay = (
    amount: Decimal,
    decimals: number,
): Decimal =>
    amount.toDecimalPlaces(
        resolveAssetDisplayPrecision(amount, decimals),
        Decimal.ROUND_DOWN,
    )
