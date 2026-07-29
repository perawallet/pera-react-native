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

import {
    getNetworkConfig,
    Networks,
    type Network,
} from '@perawallet/wallet-core-config'
import { updateNodeEndpoints } from '@perawallet/wallet-core-shared'
import {
    useNetworkStore,
    useCustomNetworkStore,
    getCustomNetworkConfig,
} from '../store'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'

/**
 * The endpoints to actually talk to. For the three real networks this is the
 * baked chain config. For `custom` it comes from the custom-network store,
 * because `config` is the leaf package and cannot read a store — see the
 * `custom` entry in `network-config.ts`.
 */
export const resolveChainEndpoints = (network: Network) => {
    const baked = getNetworkConfig(network)

    if (network !== Networks.custom) {
        return {
            algodUrl: baked.algodUrl,
            indexerUrl: baked.indexerUrl,
            algodToken: baked.algodToken,
            indexerToken: baked.indexerToken,
        }
    }

    const custom = getCustomNetworkConfig()

    return {
        algodUrl: custom?.algodUrl ?? baked.algodUrl,
        indexerUrl: custom?.indexerUrl ?? baked.indexerUrl,
        algodToken: custom?.algodToken ?? baked.algodToken,
        indexerToken: custom?.indexerToken ?? baked.indexerToken,
    }
}

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
    return createTimeoutBoundedAlgorandClient(resolveChainEndpoints(network))
}

const pushResolvedEndpointsForAllNetworks = (): void => {
    for (const network of Object.values(Networks)) {
        updateNodeEndpoints(network, resolveChainEndpoints(network))
    }
}

// Deferred past module evaluation on purpose: updateNodeEndpoints calls
// ensureClientsBuilt -> getNetworkConfig(), and doing that at import time breaks
// every test that mocks getNetworkConfig as a bare vi.fn() (it took down a whole
// package's suite once already). The try/catch keeps a hostile environment from
// turning a best-effort sync into a crash.
void Promise.resolve().then(() => {
    try {
        pushResolvedEndpointsForAllNetworks()
    } catch {
        // Clients will be built on first request regardless.
    }
})

useCustomNetworkStore.subscribe(pushResolvedEndpointsForAllNetworks)
