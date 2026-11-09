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

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { EthereumTransactionView } from '../signing/transaction-view'
import type { EvmSimulationRequest } from './types'

/** Null for a view with nothing to simulate: unpriced, mined, or a contract creation. */
export const simulationRequestOf = (
    view: EthereumTransactionView,
): Nullable<EvmSimulationRequest> => {
    if (!('fee' in view) || !view.to) return null
    return {
        from: view.from,
        to: view.to,
        value: view.value,
        data: view.data,
        gas: view.gas,
        maxFeePerGas: view.fee.maxFeePerGas,
        maxPriorityFeePerGas: view.fee.maxPriorityFeePerGas,
    }
}
