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

import type { NetworkId } from '@perawallet/wallet-core-chain-contract'
import { checkEvmRpcChainId } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/checkEvmRpcChainId'
import { evmChainOf } from '@perawallet/wallet-core-chain-ethereum/chains/table'

export type EvmnetChain =
    | 'ethereum'
    | 'base'
    | 'bsc'
    | 'arbitrum'
    | 'avalanche'
    | 'polygon'

export type EvmnetNode = {
    rpcUrl: string
    container: string
    networkId: NetworkId
    eip155ChainId: number
}

export const EVMNET_CHAINS: readonly EvmnetChain[] = [
    'ethereum',
    'base',
    'bsc',
    'arbitrum',
    'avalanche',
    'polygon',
]

// Testnet scopes only: no mainnet chain id is ever signed. Ports and chain ids
// must match tools/dev/evmnet.compose.yml.
export const EVMNET: Record<EvmnetChain, EvmnetNode> = {
    ethereum: {
        rpcUrl: 'http://127.0.0.1:8545',
        container: 'pera_evmnet_ethereum',
        networkId: 'sepolia',
        eip155ChainId: 11_155_111,
    },
    base: {
        rpcUrl: 'http://127.0.0.1:8546',
        container: 'pera_evmnet_base',
        networkId: 'sepolia',
        eip155ChainId: 84_532,
    },
    bsc: {
        rpcUrl: 'http://127.0.0.1:8547',
        container: 'pera_evmnet_bsc',
        networkId: 'testnet',
        eip155ChainId: 97,
    },
    arbitrum: {
        rpcUrl: 'http://127.0.0.1:8548',
        container: 'pera_evmnet_arbitrum',
        networkId: 'sepolia',
        eip155ChainId: 421_614,
    },
    avalanche: {
        rpcUrl: 'http://127.0.0.1:8549',
        container: 'pera_evmnet_avalanche',
        networkId: 'fuji',
        eip155ChainId: 43_113,
    },
    polygon: {
        rpcUrl: 'http://127.0.0.1:8550',
        container: 'pera_evmnet_polygon',
        networkId: 'amoy',
        eip155ChainId: 80_002,
    },
}

const REACHABILITY_TIMEOUTS = { readMs: 3000, submitMs: 3000 }

type JsonRpcResponse<T> = {
    result?: T
    error?: { code: number; message: string }
}

const RPC_TIMEOUT_MS = 10_000

export const rpcAt = async <T>(
    url: string,
    method: string,
    params: readonly unknown[] = [],
    timeoutMs = RPC_TIMEOUT_MS,
): Promise<T> => {
    // A node that accepts the connection and then stalls would otherwise hold
    // the test until the 120 s test timeout.
    let response: Response
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            signal: AbortSignal.timeout(timeoutMs),
        })
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw new Error(`${method} to ${url} failed: ${reason}`)
    }
    if (!response.ok) {
        throw new Error(
            `${method} to ${url} returned HTTP ${response.status} ${response.statusText}`,
        )
    }
    let body: JsonRpcResponse<T>
    try {
        body = (await response.json()) as JsonRpcResponse<T>
    } catch {
        throw new Error(`${method} to ${url} returned a body that is not JSON`)
    }
    if (body.error !== undefined) {
        throw new Error(
            `${method} to ${url} failed with JSON-RPC error ${body.error.code}: ${body.error.message}`,
        )
    }
    return body.result as T
}

/** Raw JSON-RPC against the chain's Anvil node, for cheat codes the app never calls. */
export const anvilRpc = <T>(
    chain: EvmnetChain,
    method: string,
    params: readonly unknown[] = [],
): Promise<T> => rpcAt<T>(EVMNET[chain].rpcUrl, method, params)

/** Fails fast with the fix, so a missing or mismatched node never surfaces as a timeout. */
export const assertRpcReachable = async (
    url: string,
    chain: EvmnetChain,
    node: EvmnetNode,
): Promise<{ blockNumber: bigint }> => {
    const verdict = await checkEvmRpcChainId(
        url,
        node.networkId,
        REACHABILITY_TIMEOUTS,
        evmChainOf(chain),
    )
    if (verdict === 'unreachable') {
        throw new Error(
            [
                `evmnet is not reachable at ${url}`,
                'Start it with: pnpm evmnet',
                'Check status: pnpm evmnet:status',
                'The EVM conformance suite requires a real node; it cannot run against mocks.',
            ].join('\n'),
        )
    }
    if (verdict === 'wrong-network') {
        const served = BigInt(await rpcAt<string>(url, 'eth_chainId'))
        throw new Error(
            `evmnet at ${url} is on the wrong network: expected chain id ${node.eip155ChainId} for ${chain}, but the node serves ${served}`,
        )
    }
    return {
        blockNumber: BigInt(await rpcAt<string>(url, 'eth_blockNumber')),
    }
}

export const assertEvmnetReachable = (
    chain: EvmnetChain,
): Promise<{ blockNumber: bigint }> =>
    assertRpcReachable(EVMNET[chain].rpcUrl, chain, EVMNET[chain])

export const setAutomine = async (
    chain: EvmnetChain,
    enabled: boolean,
): Promise<void> => {
    await anvilRpc(chain, 'evm_setAutomine', [enabled])
}

export const isAutomine = (chain: EvmnetChain): Promise<boolean> =>
    anvilRpc<boolean>(chain, 'anvil_getAutomine')

export const mine = async (chain: EvmnetChain, blocks = 1): Promise<void> => {
    await anvilRpc(chain, 'anvil_mine', [`0x${blocks.toString(16)}`])
}

/** Restores automine in `finally`: a test that throws must not leave later files waiting on a block. */
export const withAutomineOff = async <T>(
    chain: EvmnetChain,
    fn: () => Promise<T>,
): Promise<T> => {
    await setAutomine(chain, false)
    try {
        return await fn()
    } finally {
        await setAutomine(chain, true)
    }
}

export const txpoolCounts = async (
    chain: EvmnetChain,
): Promise<{ pending: number; queued: number }> => {
    const status = await anvilRpc<{ pending: string; queued: string }>(
        chain,
        'txpool_status',
    )
    return {
        pending: Number(BigInt(status.pending)),
        queued: Number(BigInt(status.queued)),
    }
}
