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
import { TransactionType } from '@algorandfoundation/algokit-utils/transact'

export * from './algorandClient'
export * from './addresses'
export * from './transactions'
export * from './json'
export * from './multisig'

export const baseUnitsToDisplayUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    const amountDecimal = new Decimal(amount.toString())
    return amountDecimal.div(Decimal.pow(10, decimals))
}

export const displayUnitsToBaseUnits = (
    amount: number | bigint | Decimal | string,
    decimals: number,
): Decimal => {
    const amountDecimal = new Decimal(amount.toString())
    return amountDecimal.mul(Decimal.pow(10, decimals))
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

export { TransactionType }
