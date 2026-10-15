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
    scopeForLegacyNetwork,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import {
    getAlgorandChainConfig,
    type AlgorandChainConfig,
    type Network,
} from '@perawallet/wallet-core-config'
import {
    PeraNetworkError,
    isPeraNetworkError,
    logger,
    parsePrecisionSafeJson,
} from '@perawallet/wallet-core-shared'
import { getAlgorandChainContext } from '../../chain-context'
import { TimeoutHttpClient } from './TimeoutHttpClient'

export type AlgorandNodeBackend = 'algod' | 'indexer'

/** An empty `token` sends no header: betanet and custom nodes are public hosts that need none. */
export type AlgorandNode = { url: string; tokenHeader: string; token: string }

export const algorandNodeOf = (
    networkConfig: Pick<
        AlgorandChainConfig,
        'algodUrl' | 'algodToken' | 'indexerUrl' | 'indexerToken'
    >,
    backend: AlgorandNodeBackend,
): AlgorandNode =>
    backend === 'algod'
        ? {
              url: networkConfig.algodUrl,
              tokenHeader: 'X-Algo-API-Token',
              token: networkConfig.algodToken,
          }
        : {
              url: networkConfig.indexerUrl,
              tokenHeader: 'X-Indexer-API-Token',
              token: networkConfig.indexerToken,
          }

export const createNodeHttpClient = (node: AlgorandNode): TimeoutHttpClient => {
    const { readMs, submitMs } = getAlgorandChainContext().timeouts
    return new TimeoutHttpClient(
        node.token.length ? { [node.tokenHeader]: node.token } : {},
        node.url,
        undefined,
        readMs,
        submitMs,
    )
}

// A caller abort keeps its identity so TanStack Query still recognises its own
// cancellation; everything else becomes a PeraNetworkError, whose kind drives
// the transient-error retry and the user-facing copy.
const toNetworkError = (error: unknown): unknown => {
    if (!(error instanceof Error)) return PeraNetworkError.fromKyError(error)
    if (error.name === 'AbortError') return error
    if (error.name === 'TimeoutError') {
        return new PeraNetworkError('timeout', { originalError: error })
    }
    const status = (error as { response?: { status?: unknown } }).response
        ?.status
    if (typeof status === 'number') {
        return new PeraNetworkError(status >= 500 ? 'server' : 'client', {
            status,
            originalError: error,
        })
    }
    return PeraNetworkError.fromKyError(error)
}

/**
 * Reads the node config on every call and caches no client, so a saved custom
 * node applies to the next request. Resolves to `undefined` for an empty body.
 */
export const fetchNodeJson = async (
    target: ChainScope | Network,
    backend: AlgorandNodeBackend,
    path: string,
    {
        params,
        signal,
    }: { params?: Record<string, unknown>; signal?: AbortSignal } = {},
): Promise<unknown> => {
    const scope =
        typeof target === 'string' ? scopeForLegacyNetwork(target) : target
    try {
        const client = createNodeHttpClient(
            algorandNodeOf(getAlgorandChainConfig(scope), backend),
        )
        const { body } = await client.get(path, params, undefined, {
            signal,
        })
        const text = new TextDecoder().decode(body)
        return text.trim() ? parsePrecisionSafeJson(text) : undefined
    } catch (error) {
        const networkError = toNetworkError(error)
        // The app's query error handler skips retryable errors on the
        // understanding that the request layer already logged them.
        if (
            isPeraNetworkError(networkError) &&
            networkError.metadata.retryable
        ) {
            logger.warn('Node request did not complete', {
                backend,
                path,
                kind: networkError.kind,
                status: networkError.status,
            })
        }
        throw networkError
    }
}
