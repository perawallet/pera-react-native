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

import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getAlgorandChainConfig,
    type Network,
} from '@perawallet/wallet-core-config'
import { resetNodeClients } from '@perawallet/wallet-core-shared'
// Side-effect import: registers the saved-node reader getChainConfig uses for `custom`.
import '../store/custom-network'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'

/**
 * Returns an instance of AlgorandClient for a specific network or scope.
 * If no target is provided, defaults to the current active network from the store.
 *
 * The algod and indexer clients are built on {@link createTimeoutBoundedAlgorandClient},
 * so every request is bounded by a per-method AbortSignal timeout (read ceiling for
 * GET/DELETE, submit ceiling for POST) and no call site can hang indefinitely.
 * @returns {AlgorandClient}
 */
export const getAlgorandClient = (target?: ChainScope | Network) => {
    const scope =
        typeof target === 'string'
            ? scopeForLegacyNetwork(target)
            : (target ??
              scopeForLegacyNetwork(useNetworkStore.getState().network))
    return createTimeoutBoundedAlgorandClient(getAlgorandChainConfig(scope))
}

// Only a custom-network edit changes endpoints; a plain switch must not rebuild every client.
useNetworkStore.subscribe((state, previous) => {
    if (state.customNetworksByChain !== previous.customNetworksByChain) {
        resetNodeClients()
    }
})
