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
    ASSET_MAX_PRECISION,
    DEFAULT_PRECISION,
    resolveAssetDisplayPrecision,
    type Maybe,
    type Nullable,
} from '@perawallet/wallet-core-shared'

/**
 * Max decimals for a unit price, and for a non-fiat preferred value on a
 * detail surface: ALGO's native precision, shared with the asset display cap,
 * so a sub-cent token price keeps its digits instead of reading `< 0.01`.
 */
export const PREFERRED_MAX_PRECISION = ASSET_MAX_PRECISION

/**
 * Semantic precision policy for a currency figure. A caller declares *what kind*
 * of value it is rendering, never raw digit counts:
 * - `noDecimal` — whole units / counts (e.g. NFT quantity): 0 dp.
 * - `compact` — a dense list/row or a summary total, asset OR preferred: a fixed
 * {@link DEFAULT_PRECISION} dp, extended only for amounts that would
 * otherwise round to zero (see {@link resolveCompactPrecision}). An asset with
 * more than {@link ASSET_MAX_PRECISION} decimals (ETH, ERC-20s) follows
 * `assetFull` instead, so its row reads like its detail. A fiat amount
 * never extends: a non-zero one under a cent renders as `< 0.01` (`> -0.01`
 * when negative; see {@link resolveFiatFloor}).
 * - `assetFull` — an asset amount on a detail surface: trims
 * {@link DEFAULT_PRECISION} → the asset's own `decimals`, capped at
 * {@link ASSET_MAX_PRECISION} (see `resolveAssetDisplayPrecision`).
 * Collectibles / 0-decimal assets resolve to 0 dp. Pair with `assetDecimals`.
 * - `preferredFull` — a preferred-currency amount on a detail surface. Fiat
 * shows {@link DEFAULT_PRECISION} dp, a non-zero amount under a cent as
 * `< 0.01` like `compact`; non-fiat trims {@link DEFAULT_PRECISION} →
 * {@link PREFERRED_MAX_PRECISION} dp.
 * - `unitPrice` — the price of one unit of an asset: trims
 * {@link DEFAULT_PRECISION} → {@link PREFERRED_MAX_PRECISION} dp, fiat or
 * not, since a cheap token's price is all sub-cent digits.
 * - `significant` — a small asset amount on a dense surface (a fee): keeps
 * {@link SIGNIFICANT_DIGITS} significant digits, between
 * {@link DEFAULT_PRECISION} and the asset's `decimals`. Pair with `assetDecimals`.
 */
export type PrecisionVariant =
    | 'noDecimal'
    | 'compact'
    | 'assetFull'
    | 'preferredFull'
    | 'unitPrice'
    | 'significant'

export type ResolvedPrecision = {
    /** Max decimals retained before trailing zeros are trimmed. */
    precision: number
    /** Floor decimals kept even when trailing zeros would otherwise trim. */
    minPrecision: number
    /**
     * Set when the amount must be pre-rounded this way before formatting;
     * the formatter itself rounds half-up.
     */
    rounding?: Decimal.Rounding
}

/**
 * Normally {@link DEFAULT_PRECISION}, but a nonzero amount that rounds to 0.00
 * there reads as nothing at all — a 0.004 ALGO fee showed as "0.00" in History.
 * Those extend to their first significant digit: `Decimal.e` is
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

export const SIGNIFICANT_DIGITS = 3

/**
 * Decimals that keep {@link SIGNIFICANT_DIGITS} significant digits of an
 * amount under 1 (an 18-decimal gas fee otherwise prints 18 digits), never
 * fewer than {@link DEFAULT_PRECISION} nor more than `assetDecimals`.
 */
export const resolveSignificantPrecision = (
    value: Maybe<Decimal>,
    assetDecimals?: number,
): number => {
    const maxPrecision = assetDecimals ?? DEFAULT_PRECISION
    if (value == null || value.isZero()) {
        return Math.min(DEFAULT_PRECISION, maxPrecision)
    }
    return Math.min(
        maxPrecision,
        Math.max(DEFAULT_PRECISION, SIGNIFICANT_DIGITS - 1 - value.e),
    )
}

/**
 * Single source of truth mapping a {@link PrecisionVariant} to the
 * `{ precision, minPrecision }` pair the formatter consumes. `assetDecimals` is
 * consulted only for `assetFull`, `significant` and `compact`; when absent it falls back to
 * {@link DEFAULT_PRECISION}, matching the legacy `asset?.decimals ?? DEFAULT_PRECISION`.
 * `value` is consulted only for `compact` and `assetFull`, whose caps can
 * hide an amount entirely, and `significant`, which falls back to 2 dp
 * without it. `isFiat` is consulted only for `preferredFull`.
 *
 * This is the only place precision policy lives. `CurrencyAmount` delegates to
 * it and never branches on asset-vs-preferred itself.
 */
export const resolvePrecision = (
    variant: PrecisionVariant,
    assetDecimals?: number,
    value?: Maybe<Decimal>,
    isFiat = false,
): ResolvedPrecision => {
    switch (variant) {
        case 'noDecimal': {
            return { precision: 0, minPrecision: 0 }
        }
        case 'compact': {
            if (assetDecimals != null && assetDecimals > ASSET_MAX_PRECISION) {
                return resolvePrecision('assetFull', assetDecimals, value)
            }
            return {
                precision: resolveCompactPrecision(value),
                minPrecision: DEFAULT_PRECISION,
            }
        }
        case 'preferredFull': {
            if (isFiat) {
                return {
                    precision: DEFAULT_PRECISION,
                    minPrecision: DEFAULT_PRECISION,
                }
            }
            return resolvePrecision('unitPrice')
        }
        case 'unitPrice': {
            return {
                precision: PREFERRED_MAX_PRECISION,
                minPrecision: DEFAULT_PRECISION,
            }
        }
        case 'assetFull': {
            const decimals = assetDecimals ?? DEFAULT_PRECISION
            return {
                precision: resolveAssetDisplayPrecision(value, decimals),
                minPrecision: Math.min(DEFAULT_PRECISION, decimals),
                // Down, so a balance never reads as more than the account holds.
                rounding: Decimal.ROUND_DOWN,
            }
        }
        case 'significant': {
            return {
                precision: resolveSignificantPrecision(value, assetDecimals),
                minPrecision: Math.min(
                    DEFAULT_PRECISION,
                    assetDecimals ?? DEFAULT_PRECISION,
                ),
            }
        }
    }
}

/**
 * The smallest fiat amount a `compact` or `preferredFull` figure shows. A
 * non-zero fiat amount under it reads as "< 0.01" instead of extending to its
 * first significant digit, which only suits crypto. The floor keeps the
 * amount's sign, so a small loss gives -0.01 and reads as a lower bound
 * ("> -0.01") rather than losing its minus. `null` when the amount renders normally.
 */
export const resolveFiatFloor = (
    variant: PrecisionVariant,
    isFiat: boolean,
    value: Maybe<Decimal>,
): Nullable<Decimal> => {
    if (
        (variant !== 'compact' && variant !== 'preferredFull') ||
        !isFiat ||
        value == null ||
        value.isZero()
    ) {
        return null
    }
    // Built on call, from a string, so a spec that mocks the shared package
    // without the Decimal helpers can still import this module.
    const floor = new Decimal(`1e-${DEFAULT_PRECISION}`)
    if (!value.abs().lt(floor)) {
        return null
    }
    return value.isNegative() ? floor.neg() : floor
}
