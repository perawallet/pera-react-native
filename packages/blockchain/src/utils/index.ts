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
    TransactionType,
    Transaction,
    encodeTransaction,
    encodeTransactionRaw,
    groupTransactions,
} from './transact'

export * from './algorandClient'
export * from './resolveGenesisHash'
export * from './clearCustomNetworkCache'
export * from './fetchGenesisFromNode'
export * from './createAlgorandClient'
export * from './TimeoutHttpClient'
export * from './addresses'
export * from './transactions'
export * from './rawTransactions'
export * from './json'
export * from './multisig'
export * from './assembleSignedMultisigTransactions'
export * from './transact'

/** e.g. `(1_000_000n, 6)` -> `Decimal(1)` — microAlgos to ALGO. */
export const baseUnitsToDisplayUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    const amountDecimal = new Decimal(amount.toString())
    return amountDecimal.div(Decimal.pow(10, decimals))
}

/** e.g. `(1, 6)` -> `Decimal(1_000_000)` — ALGO to microAlgos. */
export const displayUnitsToBaseUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    const amountDecimal = new Decimal(amount.toString())
    return amountDecimal.mul(Decimal.pow(10, decimals))
}

/** Truncates. Use at the blockchain boundary when building transactions. */
export const toBigInt = (d: Decimal): bigint => {
    return BigInt(d.toFixed(0))
}

/** {@link displayUnitsToBaseUnits} + {@link toBigInt}, for transaction building. */
export const displayUnitsToBaseUnitsBigInt = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): bigint => {
    return toBigInt(displayUnitsToBaseUnits(amount, decimals))
}

/** For transaction building. */
export const algosToMicroAlgosBigInt = (
    algos: number | bigint | Decimal | string,
): bigint => {
    return displayUnitsToBaseUnitsBigInt(algos, 6)
}

export const microAlgosToAlgos = (
    microAlgos: number | bigint | Decimal | string,
): Decimal => {
    return baseUnitsToDisplayUnits(microAlgos, 6)
}

export const algosToMicroAlgos = (
    algos: number | bigint | Decimal | string,
): Decimal => {
    return displayUnitsToBaseUnits(algos, 6)
}

export const percentChange = (first: Decimal, last: Decimal): Decimal => {
    if (first.isZero()) {
        return new Decimal(0)
    }
    return last.minus(first).div(first).mul(100)
}

export {
    TransactionType,
    Transaction,
    encodeTransaction,
    encodeTransactionRaw,
    groupTransactions,
}
