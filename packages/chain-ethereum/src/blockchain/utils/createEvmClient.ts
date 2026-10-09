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
import { ETHEREUM_CHAIN_ID } from '../../chain-id'
import { ethereumDescriptor } from '../../descriptor'
import { evmHttpTransport } from './evmHttpTransport'

export class UnconfiguredEvmRpcError extends Error {
    readonly scope: ChainScope

    constructor(scope: ChainScope) {
        super(
            `No JSON-RPC endpoint is configured for ${scope.chainId}/${scope.networkId}`,
        )
        this.name = 'UnconfiguredEvmRpcError'
        this.scope = scope
    }
}

const SUBMIT_METHODS: ReadonlySet<string> = new Set(['eth_sendRawTransaction'])

// Mirrors the Algorand client: broadcasts get the submit ceiling, everything
// else the read ceiling, and viem's own retries are off.
const timeoutBoundedTransport = (
    url: string,
    { readMs, submitMs }: ChainContext['timeouts'],
): Transport => {
    const read = evmHttpTransport(url, { timeout: readMs, retryCount: 0 })
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

const viemChainFor = (scope: ChainScope, rpcUrl: string): Chain => {
    const network = ethereumDescriptor.networks.find(
        n => n.id === scope.networkId,
    )
    if (
        scope.chainId !== ETHEREUM_CHAIN_ID ||
        network?.nativeRef.kind !== 'evm'
    ) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    const { symbol, name, decimals } = ethereumDescriptor.nativeAsset
    return defineChain({
        id: network.nativeRef.eip155ChainId,
        name: `${ethereumDescriptor.displayName} ${network.displayName}`,
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
): PublicClient => {
    const rpcUrl = ctx.getEndpoints()[scope.networkId]
    if (!rpcUrl) {
        throw new UnconfiguredEvmRpcError(scope)
    }
    return createPublicClient({
        chain: viemChainFor(scope, rpcUrl),
        transport: timeoutBoundedTransport(rpcUrl, ctx.timeouts),
    })
}
