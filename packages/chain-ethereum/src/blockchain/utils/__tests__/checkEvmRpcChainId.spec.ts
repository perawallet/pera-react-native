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
import { checkEvmRpcChainId } from '../checkEvmRpcChainId'
import { evmRpcHandlers } from '../../msw-handlers'

const RPC = 'https://my-node.rpc.test/'
const TIMEOUTS = { readMs: 1_000, submitMs: 1_000 }

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('checkEvmRpcChainId', () => {
    it('matches a node serving the network it is meant for', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC,
                responses: { eth_chainId: '0xaa36a7' },
            }),
        )

        await expect(
            checkEvmRpcChainId(RPC, 'sepolia', TIMEOUTS),
        ).resolves.toBe('matches')
    })

    it('refuses a node serving another network', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: RPC,
                responses: { eth_chainId: '0x1' },
            }),
        )

        await expect(
            checkEvmRpcChainId(RPC, 'sepolia', TIMEOUTS),
        ).resolves.toBe('wrong-network')
    })

    it('refuses a network with no EIP-155 id', async () => {
        server.use(...evmRpcHandlers({ rpcUrl: RPC }))

        await expect(
            checkEvmRpcChainId(RPC, 'holesky', TIMEOUTS),
        ).resolves.toBe('wrong-network')
    })

    it('reports a node answering with a server error as unreachable', async () => {
        server.use(http.post(RPC, () => HttpResponse.json({}, { status: 500 })))

        await expect(
            checkEvmRpcChainId(RPC, 'sepolia', TIMEOUTS),
        ).resolves.toBe('unreachable')
    })

    it('reports a failed connection as unreachable', async () => {
        server.use(http.post(RPC, () => HttpResponse.error()))

        await expect(
            checkEvmRpcChainId(RPC, 'sepolia', TIMEOUTS),
        ).resolves.toBe('unreachable')
    })
})
