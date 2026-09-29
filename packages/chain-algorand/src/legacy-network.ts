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

import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { Networks, type Network } from '@perawallet/wallet-core-shared'
import { ALGORAND_CHAIN_ID } from './chain-id'

const NETWORKS: readonly string[] = Object.values(Networks)

// Algorand's network ids are the legacy `Network` values the algod client and
// the Pera backend are keyed by.
export const algorandNetworkOf = (scope: ChainScope): Network => {
    if (
        scope.chainId !== ALGORAND_CHAIN_ID ||
        !NETWORKS.includes(scope.networkId)
    ) {
        throw new Error(
            `Not an Algorand scope: ${scope.chainId}/${scope.networkId}`,
        )
    }
    return scope.networkId as Network
}
