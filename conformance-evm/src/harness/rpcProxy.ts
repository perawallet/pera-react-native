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

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

import { EVMNET, type EvmnetChain } from './evmnet'

type JsonRpcCall = { method?: string }

const isBlockNumber = (call: JsonRpcCall): boolean =>
    call.method === 'eth_blockNumber'

/**
 * A JSON-RPC pass-through to a chain's Anvil node that, once the app has
 * been told the head (its first `eth_blockNumber`), runs `onAfterBlockNumber`
 * before the answer reaches it. The app's balance and nonce reads then
 * happen after the chain has moved, which is the only way to tell a read
 * pinned to the head it announced from one that asks for `latest`.
 */
export const withMidReadBlock = async (
    chain: EvmnetChain,
    onAfterBlockNumber: () => Promise<void>,
): Promise<{ url: string; close: () => Promise<void> }> => {
    let hasFired = false
    const server = createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('error', () => res.destroy())
        req.on('end', () => {
            void (async () => {
                try {
                    const body = Buffer.concat(chunks).toString('utf8')
                    const parsed = JSON.parse(body) as
                        | JsonRpcCall
                        | JsonRpcCall[]
                    const calls = Array.isArray(parsed) ? parsed : [parsed]
                    const upstream = await fetch(EVMNET[chain].rpcUrl, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body,
                    })
                    const answer = await upstream.text()
                    if (!hasFired && calls.some(isBlockNumber)) {
                        hasFired = true
                        await onAfterBlockNumber()
                    }
                    res.writeHead(upstream.status, {
                        'content-type': 'application/json',
                    })
                    res.end(answer)
                } catch (error) {
                    res.writeHead(502, { 'content-type': 'text/plain' })
                    res.end(String(error))
                }
            })()
        })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    return {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        close: async () => {
            server.closeAllConnections()
            await new Promise(resolve => server.close(resolve))
        },
    }
}
