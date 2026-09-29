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

// Lives in shared rather than blockchain so DB-layer and model code can convert
// units without evaluating the blockchain barrel (algod clients, stores).
// Blockchain re-exports these, which is the import path callers use.

import { Decimal } from 'decimal.js'
import { ALGO_DECIMALS } from '../constants'
import { pow10 } from './decimal-config'

/** e.g. `(1_000_000n, 6)` -> `Decimal(1)` — microAlgos to ALGO. */
export const baseUnitsToDisplayUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    return new Decimal(amount.toString()).div(pow10(decimals))
}

/**
 * e.g. `(1, 6)` -> `Decimal(1_000_000)` — ALGO to microAlgos. The result keeps
 * any fraction beyond `decimals`; {@link toBigInt} decides what happens to it.
 */
export const displayUnitsToBaseUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    return new Decimal(amount.toString()).mul(pow10(decimals))
}

/**
 * Truncates toward zero (`1.9 -> 1n`, `-1.9 -> -1n`), whatever the global
 * rounding mode: a base-unit amount built from display input must never
 * exceed what was entered. Throws on `NaN`/`Infinity`.
 */
export const toBigInt = (d: Decimal): bigint => {
    return BigInt(d.toFixed(0, Decimal.ROUND_DOWN))
}

/** {@link displayUnitsToBaseUnits} + {@link toBigInt} (truncating), for transaction building. */
export const displayUnitsToBaseUnitsBigInt = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): bigint => {
    return toBigInt(displayUnitsToBaseUnits(amount, decimals))
}

/** ALGO to microAlgos, truncating sub-microAlgo fractions. For transaction building. */
export const algosToMicroAlgosBigInt = (
    algos: number | bigint | Decimal | string,
): bigint => {
    return displayUnitsToBaseUnitsBigInt(algos, ALGO_DECIMALS)
}

export const microAlgosToAlgos = (
    microAlgos: number | bigint | Decimal | string,
): Decimal => {
    return baseUnitsToDisplayUnits(microAlgos, ALGO_DECIMALS)
}

export const algosToMicroAlgos = (
    algos: number | bigint | Decimal | string,
): Decimal => {
    return displayUnitsToBaseUnits(algos, ALGO_DECIMALS)
}
