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

import { keccak256 } from 'viem'
import type {
    ChainId,
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmSimulationRequest } from '../types'

const MODULE_PREFIX = 'evm-simulations'

// The calldata goes in as its hash: TanStack re-stringifies a key on every
// render, and a call's data can run to kilobytes.
export const simulationQueryKey = (
    scope: ChainScope,
    request: EvmSimulationRequest,
): readonly [
    typeof MODULE_PREFIX,
    ChainId,
    NetworkId,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
] => [
    MODULE_PREFIX,
    scope.chainId,
    scope.networkId,
    request.from.toLowerCase(),
    request.to.toLowerCase(),
    request.value.toFixed(),
    keccak256(request.data),
    request.gas.toString(),
    request.maxFeePerGas.toFixed(),
    request.maxPriorityFeePerGas.toFixed(),
]
