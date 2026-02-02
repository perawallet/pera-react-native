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

import { TransactionType } from '@algorandfoundation/algokit-utils/transact'

export * from './algorandClient'
export * from './addresses'
export * from './transactions'

export const microAlgosToAlgos = (microAlgos: bigint): number => {
    return Number(microAlgos) / 1_000_000
}

export const formatMicroAlgos = (microAlgos: bigint): string => {
    return microAlgosToAlgos(microAlgos).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
    })
}

export { TransactionType }
