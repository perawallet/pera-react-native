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
import { BlockchainError } from '../errors'
import { resolveChainEndpoints } from './algorandClient'

/**
 * Thrown when the active chain's identity cannot be established. Signing must
 * refuse rather than skip the genesis check — an unverified chain identity is
 * exactly the condition under which a cross-network signature becomes possible.
 *
 * Extends {@link BlockchainError} — not bare `Error` — matching every other
 * domain error in this package, so `.metadata` (severity/category/retryable)
 * survives if this is ever rethrown unwrapped. A bare `Error` reaching a
 * consumer such as the signing state machine with no `.metadata` is exactly
 * the trap this avoids.
 */
export class GenesisUnresolvableError extends BlockchainError {
    constructor(network: Network) {
        super(
            `Cannot verify network identity for ${network}: its node is unreachable and it has no pinned genesis hash.`,
            undefined,
            { params: { network } },
        )
    }
}

type CacheEntry = {
    hash: string
    expiresAt: number
}

// Runtime-resolved entries (betanet/fnet/localnet) get a short TTL, on top of
// being keyed on `${network}:${algodUrl}`. The URL-keying alone catches a
// *changed* developer override immediately (the URL changes, so the key
// changes) — but a *recreated* LocalNet container keeps the exact same URL,
// so the key is unchanged and, without the TTL, the stale hash would be
// served for the rest of the session. The TTL is what lets `algokit localnet
// reset` self-heal within a bounded window instead of requiring an app
// restart. Deliberately short: this only ever applies to developer networks.
const GENESIS_HASH_CACHE_TTL_MS = 30_000

const cache = new Map<string, CacheEntry>()

/** Test seam. */
export const clearGenesisHashCache = (): void => {
    cache.clear()
}

// Bounded by the same read ceiling as every other chain read (see
// TimeoutHttpClient / config.algodReadTimeout). This runs on the signing path,
// so an unbounded request could hang the analyzer indefinitely.
const fetchGenesisHash = async (algodUrl: string, token: string) => {
    // A developer override typed with a trailing slash must not produce
    // `//v2/...` — mirrors the normalization TimeoutHttpClient.ts applies to
    // its own base URL.
    const baseUrl = algodUrl.endsWith('/') ? algodUrl.slice(0, -1) : algodUrl
    const response = await fetch(`${baseUrl}/v2/transactions/params`, {
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
 *
 * Never returns an empty string: an empty hash is never a valid chain
 * identity, so every exit — including the MainNet/TestNet short-circuit —
 * either returns a non-empty hash or throws
 * {@link GenesisUnresolvableError}.
 */
export const resolveExpectedGenesisHash = async (
    network: Network,
): Promise<string> => {
    const baked = getNetworkConfig(network).genesisHash

    if (isMainnet(network) || isTestnet(network)) {
        if (baked.length === 0) throw new GenesisUnresolvableError(network)
        return baked
    }

    const { algodUrl, algodToken } = resolveChainEndpoints(network)
    const key = `${network}:${algodUrl}`

    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.hash

    try {
        const resolved = await fetchGenesisHash(algodUrl, algodToken)
        if (resolved) {
            cache.set(key, {
                hash: resolved,
                expiresAt: Date.now() + GENESIS_HASH_CACHE_TTL_MS,
            })
            return resolved
        }
    } catch (error) {
        logger.warn('Genesis hash resolution failed', { network, error })
    }

    if (baked.length > 0) return baked

    throw new GenesisUnresolvableError(network)
}
