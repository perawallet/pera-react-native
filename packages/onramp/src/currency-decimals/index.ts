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

import type { Nullable } from '@perawallet/wallet-core-shared'

import type { RampToken } from '../models'

/** Fiat source currencies only ever take 2 fraction digits. */
export const FIAT_MAX_FRACTION_DIGITS = 2

/**
 * Fallback cap when the source currency is unknown. Matches Algorand's maximum
 * asset decimals (19) — wide enough not to truncate a legitimate amount.
 */
export const DEFAULT_MAX_FRACTION_DIGITS = 19

/**
 * Built-in fraction-digit caps for common crypto source currencies, keyed by
 * upper-case symbol. Extend at runtime with the `onramp_currency_decimals`
 * remote-config JSON (see {@link parseCurrencyDecimalsConfig}); overrides win
 * over these defaults.
 */
export const ONRAMP_CURRENCY_FRACTION_DIGITS: Record<string, number> = {
    BTC: 8,
    ETH: 18,
    SOL: 9,
    XRP: 6,
    LTC: 8,
    BCH: 8,
    DOGE: 8,
    ADA: 6,
    TRX: 6,
    DOT: 10,
    AVAX: 18,
    BNB: 18,
    MATIC: 18,
    POL: 18,
    NEAR: 24,
    ATOM: 6,
    ALGO: 6,
    USDC: 6,
    USDT: 6,
}

/**
 * Parses the remote-config JSON map of `symbol -> fraction digits`. Invalid
 * JSON, non-object payloads, and malformed entries (non-integer or negative
 * values) are dropped so a bad config can never break amount entry.
 */
export const parseCurrencyDecimalsConfig = (
    json: Nullable<string>,
): Record<string, number> => {
    if (!json) return {}
    try {
        const parsed: unknown = JSON.parse(json)
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            Array.isArray(parsed)
        )
            return {}
        const result: Record<string, number> = {}
        for (const [symbol, value] of Object.entries(parsed)) {
            if (
                typeof value === 'number' &&
                Number.isInteger(value) &&
                value >= 0
            ) {
                result[symbol.toUpperCase()] = value
            }
        }
        return result
    } catch {
        return {}
    }
}

type CurrencyLike = Pick<RampToken, 'symbol' | 'countryCode'>

/**
 * Max fraction digits accepted for a source currency: 2 for fiat (detected by
 * `countryCode`), the configured value for known crypto, otherwise the 19-digit
 * fallback. `overrides` (typically from remote config) take precedence over the
 * built-in {@link ONRAMP_CURRENCY_FRACTION_DIGITS} map.
 */
export const getMaxFractionDigits = (
    token: Nullable<CurrencyLike>,
    overrides: Record<string, number> = {},
): number => {
    if (!token) return DEFAULT_MAX_FRACTION_DIGITS
    if (token.countryCode) return FIAT_MAX_FRACTION_DIGITS
    const symbol = token.symbol?.toUpperCase() ?? ''
    return (
        overrides[symbol] ??
        ONRAMP_CURRENCY_FRACTION_DIGITS[symbol] ??
        DEFAULT_MAX_FRACTION_DIGITS
    )
}
