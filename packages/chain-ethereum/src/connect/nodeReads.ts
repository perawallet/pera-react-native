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

import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import type { DappNodeReads } from '@perawallet/wallet-core-connections'
import { createEvmClient } from '../blockchain/utils/createEvmClient'
import { nodeReplyOf } from '../blockchain/utils/nodeVerdict'
import type { EvmChain } from '../chains/types'

const JSON_RPC_INVALID_PARAMS = -32_602

// Filters and subscriptions are left out: they live on one node, and a read
// that fails over to the next URL would ask it for a filter it never made.
export const ETHEREUM_NODE_READ_METHODS: readonly string[] = [
    'eth_blockNumber',
    'eth_call',
    'eth_estimateGas',
    'eth_feeHistory',
    'eth_gasPrice',
    'eth_getBalance',
    'eth_getBlockByHash',
    'eth_getBlockByNumber',
    'eth_getCode',
    'eth_getLogs',
    'eth_getStorageAt',
    'eth_getTransactionByHash',
    'eth_getTransactionCount',
    'eth_getTransactionReceipt',
    'eth_maxPriorityFeePerGas',
    'net_version',
]

export const createEthereumNodeReads = (
    ctx: ChainContext,
    chain: EvmChain,
): DappNodeReads => ({
    methods: ETHEREUM_NODE_READ_METHODS,
    request: async (networkId, method, params) => {
        if (!ETHEREUM_NODE_READ_METHODS.includes(method)) {
            throw new Error(`${method} is not a node read`)
        }
        const list = params ?? []
        if (!Array.isArray(list)) {
            return {
                ok: false,
                error: {
                    code: JSON_RPC_INVALID_PARAMS,
                    message: 'Expected an array of params',
                },
            }
        }
        const client = createEvmClient(
            { chainId: chain.row.id, networkId },
            ctx,
            chain,
        )
        try {
            // viem types `request` per method; the allow-list is the check here.
            const result: unknown = await (
                client.request as (args: {
                    method: string
                    params: unknown[]
                }) => Promise<unknown>
            )({ method, params: list })
            return { ok: true, result }
        } catch (error) {
            const reply = nodeReplyOf(error)
            if (!reply) throw error
            // A transport failure's message names the node URL and the request,
            // so only a JSON-RPC reply is handed back.
            return {
                ok: false,
                error: {
                    code: reply.code,
                    message: reply.details,
                    ...(reply.data === undefined ? {} : { data: reply.data }),
                },
            }
        }
    },
})
