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

import { type Decimal } from 'decimal.js'
import { DEFAULT_PRECISION, type Maybe } from '@perawallet/wallet-core-shared'

/**
 * Detailed max decimals for a preferred-currency value (fiat OR ALGO). 6 is
 * ALGO's native precision; for fiat it lets sub-cent values and unit prices
 * keep their digits instead of collapsing to `0.00`.
 */
export const PREFERRED_MAX_PRECISION = 6

/**
 * Semantic precision policy for a currency figure. A caller declares *what kind*
 * of value it is rendering, never raw digit counts:
 * - `noDecimal` — whole units / counts (e.g. NFT quantity): 0 dp.
 * - `compact` — a dense list/row or a summary total, asset OR preferred: a fixed
 *   {@link DEFAULT_PRECISION} dp, extended only for amounts that would
 *   otherwise round to zero (see {@link resolveCompactPrecision}).
 * - `assetFull` — an asset amount on a detail surface: trims
 *   {@link DEFAULT_PRECISION} → the asset's own `decimals`. Collectibles /
 *   0-decimal assets resolve to 0 dp. Pair with `assetDecimals`.
 * - `preferredFull` — a preferred-currency value (fiat or ALGO) on a detail surface:
 *   trims {@link DEFAULT_PRECISION} → {@link PREFERRED_MAX_PRECISION} dp.
 */
export type PrecisionVariant =
    | 'noDecimal'
    | 'compact'
    | 'assetFull'
    | 'preferredFull'

export type ResolvedPrecision = {
    /** Max decimals retained before trailing zeros are trimmed. */
    precision: number
    /** Floor decimals kept even when trailing zeros would otherwise trim. */
    minPrecision: number
}

/**
 * Normally {@link DEFAULT_PRECISION}, but a nonzero amount that rounds to 0.00
 * there reads as nothing at all — a 0.004 ALGO fee showed as "0.00" in History
 * (PERA-4973). Those extend to their first significant digit: `Decimal.e` is
 * that digit's base-10 exponent (0.004 → -3), so negating it gives its place.
 */
const resolveCompactPrecision = (value: Maybe<Decimal>): number => {
    if (
        value == null ||
        value.isZero() ||
        !value.toDecimalPlaces(DEFAULT_PRECISION).isZero()
    ) {
        return DEFAULT_PRECISION
    }
    return -value.e
}

/**
 * Single source of truth mapping a {@link PrecisionVariant} to the
 * `{ precision, minPrecision }` pair the formatter consumes. `assetDecimals` is
 * consulted only for `assetFull`; when absent it falls back to
 * {@link DEFAULT_PRECISION}, matching the legacy `asset?.decimals ?? DEFAULT_PRECISION`.
 * `value` is consulted only for `compact`, whose fixed 2 dp is the one policy
 * that can hide an amount entirely.
 *
 * This is the only place precision policy lives. `CurrencyAmount` delegates to
 * it and never branches on asset-vs-preferred itself.
 */
export const resolvePrecision = (
    variant: PrecisionVariant,
    assetDecimals?: number,
    value?: Maybe<Decimal>,
): ResolvedPrecision => {
    switch (variant) {
        case 'noDecimal': {
            return { precision: 0, minPrecision: 0 }
        }
        case 'compact': {
            return {
                precision: resolveCompactPrecision(value),
                minPrecision: DEFAULT_PRECISION,
            }
        }
        case 'preferredFull': {
            return {
                precision: PREFERRED_MAX_PRECISION,
                minPrecision: DEFAULT_PRECISION,
            }
        }
        case 'assetFull': {
            const decimals = assetDecimals ?? DEFAULT_PRECISION
            return {
                precision: decimals,
                minPrecision: Math.min(DEFAULT_PRECISION, decimals),
            }
        }
    }
}
