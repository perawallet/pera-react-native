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

import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import {
    getChainConfig,
    Networks,
    type Network,
} from '@perawallet/wallet-core-config'
import { updateNodeEndpoints } from '@perawallet/wallet-core-shared'
import { useNetworkStore, useCustomNetworkStore } from '../store'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'

/**
 * Returns an instance of AlgorandClient for a specific network.
 * If no network is provided, defaults to the current active network from the store.
 *
 * The algod and indexer clients are built on {@link createTimeoutBoundedAlgorandClient},
 * so every request is bounded by a per-method AbortSignal timeout (read ceiling for
 * GET/DELETE, submit ceiling for POST) and no call site can hang indefinitely.
 * @returns {AlgorandClient}
 */
export const getAlgorandClient = (networkOverride?: Network) => {
    const network = networkOverride ?? useNetworkStore.getState().network
    return createTimeoutBoundedAlgorandClient(
        getChainConfig(scopeForLegacyNetwork(network)),
    )
}

const pushResolvedEndpointsForAllNetworks = (): void => {
    for (const network of Object.values(Networks)) {
        const { algodUrl, indexerUrl, algodToken, indexerToken } =
            getChainConfig(scopeForLegacyNetwork(network))
        updateNodeEndpoints(network, {
            algodUrl,
            indexerUrl,
            algodToken,
            indexerToken,
        })
    }
}

// Deferred past module evaluation on purpose: updateNodeEndpoints calls
// ensureClientsBuilt -> config's getters, and doing that at import time breaks
// every test that mocks them as bare vi.fn()s (it took down a whole package's
// suite once already). The try/catch keeps a hostile environment from turning
// a best-effort sync into a crash.
void Promise.resolve().then(() => {
    try {
        pushResolvedEndpointsForAllNetworks()
    } catch {
        // Clients will be built on first request regardless.
    }
})

useCustomNetworkStore.subscribe(pushResolvedEndpointsForAllNetworks)
