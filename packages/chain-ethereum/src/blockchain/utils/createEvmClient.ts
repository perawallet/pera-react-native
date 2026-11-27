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
    HttpRequestError,
    TimeoutError,
    type Chain,
    type PublicClient,
    type Transport,
} from 'viem'
import type {
    ChainContext,
    ChainRequestTimeouts,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { hasIntegrityRegistrationFailed } from '@perawallet/wallet-core-app-integrity'
import { config } from '@perawallet/wallet-core-config'
import {
    AppError,
    ErrorCategory,
    withTimeout,
} from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../../chains/types'
import { eip155ChainIdOfNetwork } from './caip19'
import { evmHttpTransport, isNotSent, isPeraRpcUrl } from './evmHttpTransport'
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

// Free public nodes cap a JSON-RPC batch (Optimism's at 10) and refuse the whole
// batch past it.
const FALLBACK_READ_BATCH_SIZE = 10

// Providers also cap the request body (publicnode answers 503 past 1 MB), and
// viem splits a batch by count only. A request bigger than this goes out on
// its own, so a full batch of the rest stays under 1 MB.
const MAX_BATCHED_REQUEST_CHARS = 8000

// Counts the string payload, which is all that grows: calldata for a balance
// pass is hundreds of KB, everything else a few hundred bytes.
const payloadChars = (value: unknown): number => {
    if (typeof value === 'string') return value.length
    if (Array.isArray(value)) {
        return value.reduce<number>((sum, item) => sum + payloadChars(item), 0)
    }
    if (value !== null && typeof value === 'object') {
        return Object.values(value).reduce<number>(
            (sum, item) => sum + payloadChars(item),
            0,
        )
    }
    return 0
}

// Mirrors the Algorand client: broadcasts get the submit ceiling, everything
// else the read ceiling, and viem's own retries are off.
const timeoutBoundedTransport = (
    url: string,
    { readMs, submitMs }: ChainRequestTimeouts,
    readBatchSize: number,
): Transport => {
    // Small reads issued in the same tick go out as one JSON-RPC batch, so
    // the nonce reads of a sync pass cost one request however many accounts
    // it reads.
    const read = evmHttpTransport(url, {
        timeout: readMs,
        retryCount: 0,
        batch: { batchSize: readBatchSize },
    })
    const readAlone = evmHttpTransport(url, { timeout: readMs, retryCount: 0 })
    const submit = evmHttpTransport(url, { timeout: submitMs, retryCount: 0 })
    return params => {
        const readTransport = read(params)
        const readAloneTransport = readAlone(params)
        const submitTransport = submit(params)
        return {
            ...readTransport,
            request: (args, options) => {
                if (SUBMIT_METHODS.has(args.method)) {
                    return submitTransport.request(args, options)
                }
                return payloadChars(args.params) > MAX_BATCHED_REQUEST_CHARS
                    ? readAloneTransport.request(args, options)
                    : readTransport.request(args, options)
            },
        }
    }
}

// A broadcast stops at the first node reply and moves on only after a failure
// that says nothing about whether the node took it; the error that ends the
// loop is marked when an earlier URL left that open, so the caller doesn't
// read a later node's refusal as "not on chain".
// A request that never left the device or was refused at the door (the
// proxy's API key and integrity guard) leaves nothing open.
const leavesOutcomeOpen = (error: unknown): boolean =>
    !isNotSent(error) &&
    !(
        error instanceof HttpRequestError &&
        isPeraRpcUrl(error.url) &&
        (error.status === 401 || error.status === 403)
    )

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
            if (leavesOutcomeOpen(error)) isOutcomeOpen = true
            index += 1
        }
    }
}

// The share of the ceiling held back for each later URL, in ms. A failover only
// has to answer, and a dead first node fails fast, so the rest stays with the
// first.
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
    // Each URL's read keeps back only the reserves of the URLs after it, so a
    // hanging node still leaves them a turn, while a URL reached after a fast
    // refusal (Pera's proxy answering 403 to a device without an integrity
    // token) gets what is left. One deadline bounds the whole list.
    const reserves = splitCeilingMs(readMs, rpcUrls.length)
    const reads = reserves.map(
        (_, index) =>
            readMs - reserves.slice(index + 1).reduce((sum, ms) => sum + ms, 0),
    )
    const submits = splitCeilingMs(submitMs, rpcUrls.length)
    const perUrl = rpcUrls.map((url, index) =>
        timeoutBoundedTransport(
            url,
            { readMs: reads[index]!, submitMs: submits[index]! },
            index === 0 ? READ_BATCH_SIZE : FALLBACK_READ_BATCH_SIZE,
        ),
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
                    : withTimeout(
                          readTransport.request(args, options),
                          readMs,
                          args.method,
                          method =>
                              new TimeoutError({
                                  body: { method },
                                  url: rpcUrls.at(-1)!,
                              }),
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

const usableRpcUrls = (
    scope: ChainScope,
    ctx: Pick<ChainContext, 'getEndpoints'>,
): readonly string[] => {
    const endpoints = ctx.getEndpoints()[scope.networkId] ?? []
    // The proxy is integrity-guarded: once this launch's attestation has
    // failed it refuses every read, so leaving it out spares each read the
    // refused round trip and gives the next URL the primary batch size.
    const rpcUrls =
        config.backendAPIKey && !hasIntegrityRegistrationFailed()
            ? endpoints
            : endpoints.filter(url => !isPeraRpcUrl(url))
    if (rpcUrls.length === 0) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    return rpcUrls
}

const clientOver = (
    scope: ChainScope,
    rpcUrls: readonly string[],
    ctx: Pick<ChainContext, 'timeouts'>,
    chain: EvmChain,
): PublicClient =>
    createPublicClient({
        chain: viemChainFor(scope, rpcUrls, chain),
        transport: endpointListTransport(rpcUrls, ctx.timeouts),
    })

/**
 * `ctx.getEndpoints()` lists the network's RPC URLs in preference order.
 * Without an API key, or once the launch's integrity attestation has failed,
 * the Pera proxy cannot serve the client, so the first remaining endpoint gets
 * the primary time and batch budgets.
 */
export const createEvmClient = (
    scope: ChainScope,
    ctx: Pick<ChainContext, 'getEndpoints' | 'timeouts'>,
    chain: EvmChain,
): PublicClient => clientOver(scope, usableRpcUrls(scope, ctx), ctx, chain)

/** One client per usable RPC URL, each failing rather than failing over, for a read that must hear from every node a broadcast may have reached. */
export const createEvmNodeClients = (
    scope: ChainScope,
    ctx: Pick<ChainContext, 'getEndpoints' | 'timeouts'>,
    chain: EvmChain,
): PublicClient[] =>
    usableRpcUrls(scope, ctx).map(url => clientOver(scope, [url], ctx, chain))
