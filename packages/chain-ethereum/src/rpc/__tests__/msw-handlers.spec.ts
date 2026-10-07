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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { EvmRpcErrorFixture, evmRpcHandlers } from '../msw-handlers'

const RPC = 'https://rpc.test/'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const post = async (body: unknown, url = RPC): Promise<unknown> => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    return response.json()
}

describe('evmRpcHandlers', () => {
    it('answers each request in a batch, in order', async () => {
        server.use(...evmRpcHandlers({ rpcUrl: RPC }))

        await expect(
            post([
                { jsonrpc: '2.0', id: 1, method: 'eth_chainId' },
                { jsonrpc: '2.0', id: 2, method: 'eth_blockNumber' },
            ]),
        ).resolves.toEqual([
            { jsonrpc: '2.0', id: 1, result: '0x1' },
            { jsonrpc: '2.0', id: 2, result: '0x1' },
        ])
    })

    it('answers a method without a fixture with "method not found"', async () => {
        server.use(...evmRpcHandlers({ rpcUrl: RPC }))

        await expect(
            post({ jsonrpc: '2.0', id: 7, method: 'eth_getLogs' }),
        ).resolves.toMatchObject({ id: 7, error: { code: -32_601 } })
    })

    it('carries an error fixture code, message and data', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC,
                responses: {
                    eth_call: new EvmRpcErrorFixture(
                        3,
                        'execution reverted',
                        '0x08c379a0',
                    ),
                },
            }),
        )

        await expect(
            post({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [] }),
        ).resolves.toEqual({
            jsonrpc: '2.0',
            id: 1,
            error: {
                code: 3,
                message: 'execution reverted',
                data: '0x08c379a0',
            },
        })
    })

    it('passes a POST that is not JSON-RPC on to the next handler', async () => {
        server.use(
            ...evmRpcHandlers(),
            http.post('*/api/v1/anything', () =>
                HttpResponse.json({ handledBy: 'rest' }),
            ),
        )

        await expect(
            post({ some: 'payload' }, 'https://backend.test/api/v1/anything'),
        ).resolves.toEqual({ handledBy: 'rest' })
    })
})
