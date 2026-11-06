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

import type { Decimal } from 'decimal.js'

export type AbbreviationUnit = '' | 'K' | 'M' | 'B' | 'T'

const UNITS: readonly Exclude<AbbreviationUnit, ''>[] = ['K', 'M', 'B', 'T']
const STEP = 1000

export type AbbreviationOptions = {
    /** The smallest unit used; an amount below it comes back as it is. */
    from?: 'K' | 'M'
    /**
     * How the scaled amount rounds to `precision`; defaults to the global
     * half-up. Pass ROUND_DOWN for a balance, so it never reads above what is held.
     */
    rounding?: Decimal.Rounding
}

/**
 * Scales an amount down to thousands (K), millions (M), billions (B) or
 * trillions (T), so a figure in a row of limited width stays short. The unit
 * is a code, not display text: callers name it in the user's language. The
 * unit is picked after rounding to `precision`, so 999,999,999.999 becomes
 * 1.00 billion rather than 1,000.00 million. A scaled amount comes back
 * rounded; one below `from` comes back as it is.
 */
export const abbreviateLargeAmount = (
    amount: Decimal,
    precision: number,
    { from = 'M', rounding }: AbbreviationOptions = {},
): { amount: Decimal; unit: AbbreviationUnit } => {
    const round = (value: Decimal) =>
        rounding === undefined
            ? value.toDecimalPlaces(precision)
            : value.toDecimalPlaces(precision, rounding)
    const firstStep = from === 'K' ? STEP : STEP * STEP
    let scaled = amount
    let unit: AbbreviationUnit = ''
    for (const next of UNITS.slice(UNITS.indexOf(from))) {
        const step = unit === '' ? firstStep : STEP
        if (round(scaled.abs()).lt(step)) break
        scaled = scaled.div(step)
        unit = next
    }
    return unit === '' ? { amount, unit } : { amount: round(scaled), unit }
}
