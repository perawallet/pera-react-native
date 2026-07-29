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

import { getNetworkConfig, type Network } from '@perawallet/wallet-core-config'
import { useNetworkStore } from '../store'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'

/**
 * The endpoints to actually talk to: the baked chain config for the network.
 *
 * NOTE: this used to layer a per-network developer endpoint override on top
 * (`node-override-store.ts`), which this rework retires. `custom` is now the
 * one runtime-configurable network, with its real config in
 * `custom-network-store.ts` (packages/blockchain/src/store) — wiring that
 * store's values in here (and re-adding the module-level subscription that
 * used to keep `shared`'s ky clients in sync) is a later task, so for now
 * this simply returns the baked config, which for `custom` is the
 * deliberately-empty placeholder in network-config.ts.
 */
export const resolveChainEndpoints = (network: Network) => {
    const { algodUrl, indexerUrl, algodToken, indexerToken } =
        getNetworkConfig(network)

    return { algodUrl, indexerUrl, algodToken, indexerToken }
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

// NOTE: this file used to also keep `shared`'s ky algod/indexer clients in
// step with the (now-removed) per-network override store via a module-level
// `useNodeOverrideStore.subscribe(...)` plus a deferred initial push — see
// git history for the exact mechanism. That hydration-ordering problem is
// real and still applies to the custom-network store, so a later task must
// re-add an equivalent subscription retargeted at `useCustomNetworkStore`,
// not skip it.
