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

import http from 'node:http'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'

// JSON-RPC responder standing in for an EVM node, so a signed transaction
// never reaches a real chain. It keeps every raw transaction it is sent, and
// every method it has no answer for, so a test can tell "the wallet never
// broadcast" from "the wallet asked for something the fake doesn't serve".

// The e2e bundle (`pnpm --filter browser bundle:e2e`) bakes this as every EVM
// RPC URL. Playwright never attaches to the offscreen document, so
// `context.route` cannot cover it; a real server on localhost covers every
// extension page.
export const E2E_EVM_RPC_PORT = 18_545
export const E2E_EVM_RPC_URL = `http://127.0.0.1:${E2E_EVM_RPC_PORT}`

// The wallet derives a sent transaction's hash from its own signed bytes, so a
// node answering any other hash would disagree with what the dApp is told.
export const evmTxHashOf = raw =>
    `0x${bytesToHex(keccak_256(hexToBytes(raw.slice(2))))}`

const GWEI = 1_000_000_000n
const BLOCK_NUMBER = 16_777_216n
const BASE_FEE = 10n * GWEI
const PRIORITY_FEE = 1n * GWEI

const toHex = value => `0x${BigInt(value).toString(16)}`
const hash32 = byte => `0x${byte.repeat(32)}`

const block = () => ({
    number: toHex(BLOCK_NUMBER),
    hash: hash32('11'),
    parentHash: hash32('10'),
    nonce: '0x0000000000000000',
    sha3Uncles: hash32('00'),
    logsBloom: `0x${'00'.repeat(256)}`,
    transactionsRoot: hash32('00'),
    stateRoot: hash32('00'),
    receiptsRoot: hash32('00'),
    miner: `0x${'00'.repeat(20)}`,
    difficulty: '0x0',
    totalDifficulty: '0x0',
    extraData: '0x',
    size: '0x1',
    gasLimit: toHex(30_000_000n),
    gasUsed: toHex(15_000_000n),
    timestamp: toHex(Math.floor(Date.now() / 1000)),
    baseFeePerGas: toHex(BASE_FEE),
    transactions: [],
    uncles: [],
})

export const createFakeEvmNode = () => {
    // Set once the dApp's chain is known; one node answers every chain's URL.
    let chainId = 1
    const rawTransactions = []
    const unansweredMethods = []
    const methods = []

    const results = {
        eth_chainId: () => toHex(chainId),
        net_version: () => String(chainId),
        eth_blockNumber: () => toHex(BLOCK_NUMBER),
        eth_getTransactionCount: () => '0x0',
        eth_estimateGas: () => toHex(21_000n),
        eth_gasPrice: () => toHex(BASE_FEE + PRIORITY_FEE),
        eth_maxPriorityFeePerGas: () => toHex(PRIORITY_FEE),
        eth_getBlockByNumber: () => block(),
        eth_feeHistory: ([blockCount, , percentiles]) => {
            const count = Number(BigInt(blockCount ?? 1))
            return {
                oldestBlock: toHex(BLOCK_NUMBER - BigInt(count) + 1n),
                baseFeePerGas: Array.from({ length: count + 1 }, () =>
                    toHex(BASE_FEE),
                ),
                gasUsedRatio: Array.from({ length: count }, () => 0.5),
                // One tip per requested percentile, per block.
                reward: Array.from({ length: count }, () =>
                    (percentiles ?? []).map(() => toHex(PRIORITY_FEE)),
                ),
            }
        },
        // Not mined: the wallet's own reconcile keeps asking after a send.
        eth_getTransactionReceipt: () => null,
        // 1 ETH, so a 1-wei send is always affordable.
        eth_getBalance: () => toHex(10n ** 18n),
        eth_sendRawTransaction: ([raw]) => {
            rawTransactions.push(raw)
            return evmTxHashOf(raw)
        },
    }

    const answer = ({ id, method, params }) => {
        methods.push(method)
        const result = results[method]
        if (!result) {
            unansweredMethods.push(method)
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32_601, message: `${method} not served` },
            }
        }
        return { jsonrpc: '2.0', id, result: result(params ?? []) }
    }

    const respond = body =>
        Array.isArray(body) ? body.map(answer) : answer(body)
    const isBroadcast = body =>
        (Array.isArray(body) ? body : [body]).some(
            call => call?.method === 'eth_sendRawTransaction',
        )
    let held = null

    return {
        rawTransactions,
        unansweredMethods,
        methods,
        setChainId: id => {
            chainId = id
        },
        /** Answers one JSON-RPC body, single or batched. */
        respond,
        /** As `respond`, but a broadcast waits while `holdBroadcasts` holds it. */
        reply: async body => {
            const reply = respond(body)
            if (held && isBroadcast(body)) await held
            return reply
        },
        /**
         * Records broadcasts on arrival but answers none until the returned
         * release is called.
         */
        holdBroadcasts: () => {
            let release = () => {}
            held = new Promise(resolve => {
                release = resolve
            })
            return () => {
                held = null
                release()
            }
        },
    }
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
}

/** Serves `node` over HTTP on 127.0.0.1, the way an EVM node's RPC URL is. */
export const serveFakeEvmNode = async (node, { port }) => {
    const server = http.createServer((request, response) => {
        if (request.method === 'OPTIONS') {
            response.writeHead(204, CORS_HEADERS).end()
            return
        }
        if (request.method !== 'POST') {
            response.writeHead(404, CORS_HEADERS).end()
            return
        }
        const chunks = []
        request.on('data', chunk => chunks.push(chunk))
        request.on('end', () => {
            let body
            try {
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            } catch {
                response.writeHead(400, CORS_HEADERS).end()
                return
            }
            void node.reply(body).then(reply => {
                response.writeHead(200, {
                    ...CORS_HEADERS,
                    'Content-Type': 'application/json',
                })
                response.end(JSON.stringify(reply))
            })
        })
    })
    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', () => {
            server.off('error', reject)
            resolve()
        })
    })
    return {
        url: `http://127.0.0.1:${port}`,
        // Chrome keeps its connections alive, which would hold close() open.
        close: () =>
            new Promise(resolve => {
                server.close(() => resolve())
                server.closeAllConnections()
            }),
    }
}
