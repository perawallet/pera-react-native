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
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainContext } from '@perawallet/wallet-core-chain-contract'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
} from '../../blockchain/msw-handlers'
import { ETHEREUM } from '../../__tests__/evm-chains'
import {
    ETHEREUM_NODE_READ_METHODS,
    createEthereumNodeReads,
} from '../nodeReads'

const MAINNET_RPC = 'https://mainnet.rpc.test/'
const SEPOLIA_RPC = 'https://sepolia.rpc.test/'
const ADDRESS = '0x00000000000000000000000000000000000000aa'

const contextWith = (readMs = 1_000): ChainContext => ({
    getScope: () => ({ chainId: 'ethereum', networkId: 'mainnet' }),
    getEndpoints: () => ({
        mainnet: [MAINNET_RPC],
        sepolia: [SEPOLIA_RPC],
    }),
    getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
    timeouts: { readMs, submitMs: 1_000 },
    kms: {} as ChainContext['kms'],
})

// Unhandled requests fail the test: nothing here may reach a real node.
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createEthereumNodeReads', () => {
    it('lists reads only, never a method that signs or broadcasts', () => {
        expect(ETHEREUM_NODE_READ_METHODS).toContain('eth_call')
        expect(ETHEREUM_NODE_READ_METHODS).not.toContain(
            'eth_sendRawTransaction',
        )
        expect(ETHEREUM_NODE_READ_METHODS).not.toContain('eth_newFilter')
        expect(createEthereumNodeReads(contextWith(), ETHEREUM).methods).toBe(
            ETHEREUM_NODE_READ_METHODS,
        )
    })

    it("returns the node's answer", async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: MAINNET_RPC,
                responses: { eth_getBalance: '0xde0b6b3a7640000' },
            }),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_getBalance', [ADDRESS, 'latest']),
        ).resolves.toEqual({ ok: true, result: '0xde0b6b3a7640000' })
    })

    it('reads from the network it is asked about', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: MAINNET_RPC,
                responses: { eth_blockNumber: '0x1' },
            }),
            ...evmRpcHandlers({
                rpcUrl: SEPOLIA_RPC,
                responses: { eth_blockNumber: '0x2' },
            }),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('sepolia', 'eth_blockNumber', []),
        ).resolves.toEqual({ ok: true, result: '0x2' })
    })

    it("relays a node's JSON-RPC error with its code, message and data", async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: MAINNET_RPC,
                responses: {
                    eth_call: new EvmRpcErrorFixture(
                        3,
                        'execution reverted',
                        '0x08c379a0',
                    ),
                },
            }),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_call', [{ to: ADDRESS }, 'latest']),
        ).resolves.toEqual({
            ok: false,
            error: {
                code: 3,
                message: 'execution reverted',
                data: '0x08c379a0',
            },
        })
    })

    it('leaves data off an error the node sent none with', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: MAINNET_RPC,
                responses: {
                    eth_estimateGas: new EvmRpcErrorFixture(-32_000, 'nope'),
                },
            }),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        const answer = await reads.request('mainnet', 'eth_estimateGas', [{}])

        expect(answer).toEqual({
            ok: false,
            error: { code: -32_000, message: 'nope' },
        })
        expect(answer.ok === false && 'data' in answer.error).toBe(false)
    })

    it('rejects when no node replies', async () => {
        server.use(
            http.post(
                MAINNET_RPC,
                () => new HttpResponse(null, { status: 500 }),
            ),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_blockNumber', []),
        ).rejects.toThrow()
    })

    it('rejects when the node is slower than the read timeout', async () => {
        server.use(
            http.post(MAINNET_RPC, async () => {
                await delay(500)
                return HttpResponse.json({})
            }),
        )
        const reads = createEthereumNodeReads(contextWith(50), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_blockNumber', []),
        ).rejects.toThrow()
    })

    it('throws for a method it does not list, without asking a node', async () => {
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_sendRawTransaction', ['0x02']),
        ).rejects.toThrow()
    })

    it('sends no params as an empty list', async () => {
        let seen: unknown
        server.use(
            // Reads in one tick are sent as a JSON-RPC batch.
            http.post(MAINNET_RPC, async ({ request }) => {
                const calls = (await request.json()) as Array<{
                    id: number
                    params: unknown
                }>
                seen = calls[0]?.params
                return HttpResponse.json(
                    calls.map(({ id }) => ({
                        jsonrpc: '2.0',
                        id,
                        result: '0x1',
                    })),
                )
            }),
        )
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await reads.request('mainnet', 'eth_blockNumber', undefined)

        expect(seen).toEqual([])
    })

    it('answers -32602 for params that are not a list, without asking a node', async () => {
        const reads = createEthereumNodeReads(contextWith(), ETHEREUM)

        await expect(
            reads.request('mainnet', 'eth_getBalance', { address: ADDRESS }),
        ).resolves.toMatchObject({ ok: false, error: { code: -32_602 } })
    })
})
