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
export * from './createWalletAlgorandClient'
export * from './TimeoutHttpClient'
export * from './confirmation'
export * from './addresses'
export * from './transactions'
export * from './rawTransactions'
export * from './json'
export * from './multisig'
export * from './assembleSignedMultisigTransactions'
export * from './transact'
export {
    baseUnitsToDisplayUnits,
    displayUnitsToBaseUnits,
    toBigInt,
    displayUnitsToBaseUnitsBigInt,
    algosToMicroAlgosBigInt,
    microAlgosToAlgos,
    algosToMicroAlgos,
} from '@perawallet/wallet-core-shared'

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
