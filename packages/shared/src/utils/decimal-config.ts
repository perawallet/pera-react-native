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

import { Decimal } from 'decimal.js'
import type { Nullable } from './types'

/**
 * Initializes the global Decimal.js configuration for the app.
 *
 * Must be called once at app startup, before any Decimal operations.
 *
 * - precision: 40 — Algorand uint64 values can have up to 20 significant digits,
 *   and intermediate arithmetic (e.g., multiplying two large amounts) can require
 *   up to double that. 40 provides ample headroom for all financial calculations.
 * - rounding: ROUND_HALF_UP — standard financial rounding.
 * - crypto: true — uses crypto.getRandomValues() for randomness.
 */
export const initDecimalConfig = () => {
    Decimal.set({
        precision: 40,
        crypto: true,
        rounding: Decimal.ROUND_HALF_UP,
    })
}

// Apply config immediately on import as a safety net
initDecimalConfig()

/**
 * Null-safe equality check for two Decimal values.
 * Returns true if both are null, or both are non-null and numerically equal.
 */
export const isDecimalEqual = (
    a: Nullable<Decimal>,
    b: Nullable<Decimal>,
): boolean => {
    if (a === b) return true
    if (a === null || b === null) return false
    return a.equals(b)
}

/**
 * Wraps a raw value (decimal string or number) in `Decimal`. Missing/empty
 * values become `Decimal(0)` rather than throwing or producing `NaN`. Use at
 * API boundaries where a numeric field may be null/undefined/'' — for fields
 * that must be present, construct `new Decimal(value)` directly so a missing
 * value surfaces as an error instead of being silently zeroed.
 */
export const toDecimal = (
    value: string | number | null | undefined,
): Decimal => {
    if (value === null || value === undefined || value === '') {
        return new Decimal(0)
    }
    return new Decimal(value)
}

const POW10_CACHE = new Map<number, Decimal>()

/**
 * Returns `10^decimals` as a `Decimal`, memoized. Scaling base units to display
 * units (`amount.div(pow10(decimals))`) happens for every holding, and decimals
 * repeat heavily across assets (most use 6), so caching avoids recomputing
 * `Decimal.pow()` thousands of times when materializing a large account.
 */
export const pow10 = (decimals: number): Decimal => {
    let value = POW10_CACHE.get(decimals)
    if (!value) {
        value = new Decimal(10).pow(decimals)
        POW10_CACHE.set(decimals, value)
    }
    return value
}

export { Decimal }
