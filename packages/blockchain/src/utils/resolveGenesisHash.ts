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
    config,
    getNetworkConfig,
    isMainnet,
    isTestnet,
    type Network,
} from '@perawallet/wallet-core-config'
import { logger } from '@perawallet/wallet-core-shared'
import { resolveChainEndpoints } from './algorandClient'

/**
 * Thrown when the active chain's identity cannot be established. Signing must
 * refuse rather than skip the genesis check — an unverified chain identity is
 * exactly the condition under which a cross-network signature becomes possible.
 */
export class GenesisUnresolvableError extends Error {
    constructor(network: Network) {
        super(
            `Cannot verify network identity for ${network}: its node is unreachable and it has no pinned genesis hash.`,
        )
        this.name = 'GenesisUnresolvableError'
    }
}

// Keyed on `${network}:${algodUrl}` so a changed override or a recreated
// LocalNet container re-resolves instead of serving a stale identity.
const cache = new Map<string, string>()

/** Test seam. */
export const clearGenesisHashCache = (): void => {
    cache.clear()
}

// Bounded by the same read ceiling as every other chain read (see
// TimeoutHttpClient / config.algodReadTimeout). This runs on the signing path,
// so an unbounded request could hang the analyzer indefinitely.
const fetchGenesisHash = async (algodUrl: string, token: string) => {
    const response = await fetch(`${algodUrl}/v2/transactions/params`, {
        headers: token.length ? { 'X-Algo-API-Token': token } : {},
        signal: AbortSignal.timeout(config.algodReadTimeout),
    })
    if (!response.ok) return undefined
    const body = (await response.json()) as { 'genesis-hash'?: unknown }
    const hash = body['genesis-hash']
    return typeof hash === 'string' && hash.length > 0 ? hash : undefined
}

/**
 * The genesis hash to compare signable transactions against.
 *
 * MainNet and TestNet always use their build-time-pinned value: the two
 * networks holding real value must not take their chain identity from a
 * runtime response. betanet/fnet/localnet resolve from the node, because their
 * genesis changes on every network (or container) reset.
 */
export const resolveExpectedGenesisHash = async (
    network: Network,
): Promise<string> => {
    const baked = getNetworkConfig(network).genesisHash

    if (isMainnet(network) || isTestnet(network)) return baked

    const { algodUrl, algodToken } = resolveChainEndpoints(network)
    const key = `${network}:${algodUrl}`

    const cached = cache.get(key)
    if (cached) return cached

    try {
        const resolved = await fetchGenesisHash(algodUrl, algodToken)
        if (resolved) {
            cache.set(key, resolved)
            return resolved
        }
    } catch (error) {
        logger.warn('Genesis hash resolution failed', { network, error })
    }

    if (baked.length > 0) return baked

    throw new GenesisUnresolvableError(network)
}
