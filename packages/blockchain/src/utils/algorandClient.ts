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
import { logger, updateNodeEndpoints } from '@perawallet/wallet-core-shared'
import {
    getNodeEndpointOverride,
    useNetworkStore,
    useNodeOverrideStore,
} from '../store'
import { createTimeoutBoundedAlgorandClient } from './createAlgorandClient'

/**
 * The endpoints to actually talk to: baked chain config with any persisted
 * developer override layered on top. Tokens are never overridden — LocalNet's
 * differs from the hosted providers', and that comes from the chain config.
 */
export const resolveChainEndpoints = (network: Network) => {
    const { algodUrl, indexerUrl, algodToken, indexerToken } =
        getNetworkConfig(network)
    const override = getNodeEndpointOverride(network)

    return {
        algodUrl: override?.algodUrl ?? algodUrl,
        indexerUrl: override?.indexerUrl ?? indexerUrl,
        algodToken,
        indexerToken,
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

// Keep the shared ky algod/indexer instances in step with overrides. `shared`
// cannot import `blockchain`, so the write direction is blockchain -> shared.
//
// Iterate ALL networks, not just the currently-overridden keys: clearOverride
// and resetState DELETE the key, so a keys-only loop would never re-sync a
// cleared network and its ky clients would keep serving the stale overridden URL
// until app restart. resolveChainEndpoints falls back to baked config when no
// override exists, so this restores cleared networks for free and is correct for
// every transition (set / merge / clear / reset).
useNodeOverrideStore.subscribe(pushResolvedEndpointsForAllNetworks)

// The subscription above only fires on a FUTURE store change — but zustand's
// `persist` hydration is SYNCHRONOUS here (MMKV's `getString` is sync), so it
// completes inside `create()` in `node-override-store.ts`, before the
// `subscribe()` call above even runs. A persisted override from a previous
// session is therefore already sitting in the store by the time this module
// finishes evaluating, and the subscriber above never fires for it.
//
// Concretely: a developer sets a LAN address for localnet and relaunches.
// Balances still work (`getAlgorandClient`/`useAlgorandClient` call
// `resolveChainEndpoints` live, per call), but the `shared` ky INDEXER client
// keeps serving the baked default — transaction history and indexer asset
// metadata stay unreachable while balances succeed. Same after an fnet reset
// moves endpoints.
//
// `persist.onFinishHydration` is NOT a fix for the same reason: its
// listeners also run synchronously inside `create()`, before this module has
// even finished its own evaluation.
//
// So: push once, but deferred past this module's synchronous evaluation
// rather than run inline here. Calling `pushResolvedEndpointsForAllNetworks`
// directly at this point would call `getNetworkConfig()` as a side effect of
// merely IMPORTING this module — the same hazard already fixed once for
// `shared`'s own client construction (see the `ensureClientsBuilt` comment in
// `query-client.ts`): several packages' tests mock `getNetworkConfig` as a
// bare `vi.fn()` with no default return, and this module is reachable
// transitively from most of them through `@perawallet/wallet-core-blockchain`'s
// barrel. The try/catch exists for the same reason — a test that never
// configures that mock must not see an uncaught exception from a push it
// never asked for. The inner try/catch around the log call is deliberate
// too: some of those same tests mock `@perawallet/wallet-core-shared`
// without a `logger` export at all, and merely reading `logger.warn` off
// that mock throws — a failed best-effort push must not escalate into an
// unhandled rejection via its own error report.
void Promise.resolve().then(() => {
    try {
        pushResolvedEndpointsForAllNetworks()
    } catch (error) {
        try {
            logger.warn('Initial node-endpoint override push failed', {
                error,
            })
        } catch {
            // See comment above — logging itself is best-effort here.
        }
    }
})
