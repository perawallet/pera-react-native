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
    createPublicClient,
    defineChain,
    fallback,
    type Chain,
    type PublicClient,
    type Transport,
} from 'viem'
import type {
    ChainContext,
    ChainRequestTimeouts,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../../chains/types'
import { eip155ChainIdOfNetwork } from './caip19'
import { evmHttpTransport } from './evmHttpTransport'
import { isNodeReply, markAfterUnconfirmedAttempt } from './nodeVerdict'

export class UnconfiguredEvmRpcError extends AppError {
    readonly scope: ChainScope

    constructor(scope: ChainScope) {
        super(
            `No JSON-RPC endpoint is configured for ${scope.chainId}/${scope.networkId}`,
            { category: ErrorCategory.NETWORK },
        )
        this.name = 'UnconfiguredEvmRpcError'
        this.scope = scope
    }
}

const SUBMIT_METHODS: ReadonlySet<string> = new Set(['eth_sendRawTransaction'])

// Providers cap the size of a JSON-RPC batch; a larger tick splits.
const READ_BATCH_SIZE = 100

// Mirrors the Algorand client: broadcasts get the submit ceiling, everything
// else the read ceiling, and viem's own retries are off.
const timeoutBoundedTransport = (
    url: string,
    { readMs, submitMs }: ChainRequestTimeouts,
): Transport => {
    // Reads issued in the same tick go out as one JSON-RPC batch, so a sync
    // pass costs a few requests however many accounts it reads.
    const read = evmHttpTransport(url, {
        timeout: readMs,
        retryCount: 0,
        batch: { batchSize: READ_BATCH_SIZE },
    })
    const submit = evmHttpTransport(url, { timeout: submitMs, retryCount: 0 })
    return params => {
        const readTransport = read(params)
        const submitTransport = submit(params)
        return {
            ...readTransport,
            request: (args, options) =>
                SUBMIT_METHODS.has(args.method)
                    ? submitTransport.request(args, options)
                    : readTransport.request(args, options),
        }
    }
}

// A broadcast stops at the first node reply and moves on only after a failure
// that says nothing about whether the node took it; the error that ends the
// loop is marked when an earlier URL left that open, so the caller doesn't
// read a later node's refusal as "not on chain".
const broadcastInOrder = async (
    transports: readonly ReturnType<Transport>[],
    args: Parameters<ReturnType<Transport>['request']>[0],
    options: Parameters<ReturnType<Transport>['request']>[1],
): Promise<unknown> => {
    const last = transports.length - 1
    let isOutcomeOpen = false
    let index = 0
    for (;;) {
        try {
            return await transports[index]!.request(args, options)
        } catch (error) {
            if (index === last || isNodeReply(error)) {
                if (isOutcomeOpen) markAfterUnconfirmedAttempt(error)
                throw error
            }
            isOutcomeOpen = true
            index += 1
        }
    }
}

// Longest a later URL is given, in ms. A failover only has to answer, and a dead
// first node fails fast, so the rest of the ceiling stays with the first.
const FAILOVER_RESERVE_MS = 3000

/**
 * The signing pipeline's backstop assumes one submit ceiling, so the URLs of a
 * network share it: each later URL gets a reserve (a quarter of the ceiling, at
 * most FAILOVER_RESERVE_MS) and the first keeps the rest. An equal split would
 * halve a healthy but slow first node's budget as soon as a fallback exists.
 */
export const splitCeilingMs = (ms: number, urlCount: number): number[] => {
    const reserve = Math.max(
        1,
        Math.min(FAILOVER_RESERVE_MS, Math.floor(ms / 4)),
    )
    const first = Math.max(1, ms - reserve * (urlCount - 1))
    return [first, ...Array.from({ length: urlCount - 1 }, () => reserve)]
}

// fallback() defaults to three retries of its own, which would multiply the
// ceiling again.
const endpointListTransport = (
    rpcUrls: readonly string[],
    { readMs, submitMs }: ChainRequestTimeouts,
): Transport => {
    const reads = splitCeilingMs(readMs, rpcUrls.length)
    const submits = splitCeilingMs(submitMs, rpcUrls.length)
    const perUrl = rpcUrls.map((url, index) =>
        timeoutBoundedTransport(url, {
            readMs: reads[index]!,
            submitMs: submits[index]!,
        }),
    )
    const readFallback = fallback(perUrl, { retryCount: 0 })
    return params => {
        const readTransport = readFallback(params)
        const urlTransports = perUrl.map(transport => transport(params))
        return {
            ...readTransport,
            request: ((args, options) =>
                SUBMIT_METHODS.has(args.method)
                    ? broadcastInOrder(urlTransports, args, options)
                    : readTransport.request(
                          args,
                          options,
                      )) as typeof readTransport.request,
        }
    }
}

const viemChainFor = (
    scope: ChainScope,
    rpcUrls: readonly string[],
    chain: EvmChain,
): Chain => {
    const { descriptor } = chain
    const network = descriptor.networks.find(n => n.id === scope.networkId)
    const eip155ChainId = eip155ChainIdOfNetwork(chain, scope.networkId)
    if (
        scope.chainId !== descriptor.id ||
        !network ||
        eip155ChainId === undefined
    ) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    const { symbol, name, decimals } = descriptor.nativeAsset
    return defineChain({
        id: eip155ChainId,
        name: `${descriptor.displayName} ${network.displayName}`,
        nativeCurrency: { symbol, name, decimals },
        rpcUrls: { default: { http: [...rpcUrls] } },
    })
}

/**
 * `ctx.getEndpoints()` maps each network id to its public JSON-RPC URLs,
 * preferred first; reads go straight to those nodes, not through the Pera
 * backend. A request that fails on one node is tried on the next, in order.
 */
export const createEvmClient = (
    scope: ChainScope,
    ctx: Pick<ChainContext, 'getEndpoints' | 'timeouts'>,
    chain: EvmChain,
): PublicClient => {
    const rpcUrls = ctx.getEndpoints()[scope.networkId]
    if (!rpcUrls || rpcUrls.length === 0) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    return createPublicClient({
        chain: viemChainFor(scope, rpcUrls, chain),
        transport: endpointListTransport(rpcUrls, ctx.timeouts),
    })
}
