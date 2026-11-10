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

import type {
    ChainId,
    ChainScope,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'
import type { EvmContractPart } from '../api/endpoints'

const MODULE_PREFIX = 'evm-contracts'

// Memory only: `query-persistence.ts` keeps this prefix off disk, since its
// keys are the contracts dApps asked the user to call. An hour covers every
// step of a dApp flow; an ABI changes only on a proxy upgrade.
export const CONTRACT_CACHE_TIME_MS = 60 * 60_000

export const contractQueryKey = (
    part: EvmContractPart,
    scope: ChainScope,
    address: string,
): readonly [
    typeof MODULE_PREFIX,
    EvmContractPart,
    ChainId,
    NetworkId,
    string,
] => [
    MODULE_PREFIX,
    part,
    scope.chainId,
    scope.networkId,
    address.toLowerCase(),
]
