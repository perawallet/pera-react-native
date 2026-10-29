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
    type Chain,
    type PublicClient,
    type Transport,
} from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { AppError, ErrorCategory } from '@perawallet/wallet-core-shared'
import type { EvmChain } from '../../chains/types'
import { eip155ChainIdOfNetwork } from './caip19'
import { evmHttpTransport } from './evmHttpTransport'

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
    { readMs, submitMs }: ChainContext['timeouts'],
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

const viemChainFor = (
    scope: ChainScope,
    rpcUrl: string,
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
        rpcUrls: { default: { http: [rpcUrl] } },
    })
}

/**
 * `ctx.getEndpoints()` maps each network id to its public JSON-RPC URL; reads
 * go straight to that node, not through the Pera backend.
 */
export const createEvmClient = (
    scope: ChainScope,
    ctx: ChainContext,
    chain: EvmChain,
): PublicClient => {
    const rpcUrl = ctx.getEndpoints()[scope.networkId]
    if (!rpcUrl) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    return createPublicClient({
        chain: viemChainFor(scope, rpcUrl, chain),
        transport: timeoutBoundedTransport(rpcUrl, ctx.timeouts),
    })
}
