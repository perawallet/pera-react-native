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
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { keccak256, TimeoutError, type Hex } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { createEvmClient, UnconfiguredEvmRpcError } from '../client'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
} from '../msw-handlers'

const MAINNET_RPC = 'https://mainnet.rpc.test/'
const SEPOLIA_RPC = 'https://sepolia.rpc.test/'
const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'
const RAW_TX: Hex = '0x02f86c0180843b9aca00'

const contextWith = ({
    endpoints = { mainnet: MAINNET_RPC, sepolia: SEPOLIA_RPC },
    timeouts = { readMs: 1_000, submitMs: 1_000 },
}: {
    endpoints?: Record<string, string>
    timeouts?: ChainContext['timeouts']
} = {}): ChainContext => ({
    getScope: () => MAINNET,
    getEndpoints: () => endpoints,
    timeouts,
    http: { request: vi.fn() },
    kms: {} as ChainContext['kms'],
})

// Unhandled requests fail the test: nothing here may reach a real node.
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createEvmClient', () => {
    describe('against the JSON-RPC factory', () => {
        it('reads the chain id, block number, balance and nonce', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: {
                        eth_blockNumber: '0x10',
                        eth_getBalance: params =>
                            params[0] === ADDRESS ? '0xde0b6b3a7640000' : '0x0',
                        eth_getTransactionCount: '0x7',
                    },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith())

            await expect(client.getChainId()).resolves.toBe(1)
            await expect(client.getBlockNumber()).resolves.toBe(16n)
            await expect(client.getBalance({ address: ADDRESS })).resolves.toBe(
                10n ** 18n,
            )
            await expect(
                client.getTransactionCount({ address: ADDRESS }),
            ).resolves.toBe(7)
        })

        it('estimates gas and reads the fee history', async () => {
            server.use(...evmRpcHandlers({ rpcUrl: MAINNET_RPC }))
            const client = createEvmClient(MAINNET, contextWith())

            await expect(
                client.estimateGas({ account: ADDRESS, to: ADDRESS }),
            ).resolves.toBe(21_000n)
            await expect(
                client.getFeeHistory({
                    blockCount: 1,
                    rewardPercentiles: [50],
                }),
            ).resolves.toMatchObject({
                baseFeePerGas: [1_000_000_000n, 1_000_000_000n],
                reward: [[1_000_000_000n]],
            })
        })

        it('returns the eth_call payload', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: { eth_call: '0x2a' },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith())

            await expect(
                client.call({ to: ADDRESS, data: '0x70a08231' }),
            ).resolves.toEqual({ data: '0x2a' })
        })

        it('broadcasts a signed transaction and reads its receipt', async () => {
            const hash = keccak256(RAW_TX)
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: {
                        eth_getTransactionReceipt: params =>
                            params[0] === hash
                                ? evmTransactionReceipt({
                                      transactionHash: hash,
                                  })
                                : null,
                    },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith())

            await expect(
                client.sendRawTransaction({ serializedTransaction: RAW_TX }),
            ).resolves.toBe(hash)
            await expect(
                client.getTransactionReceipt({ hash }),
            ).resolves.toMatchObject({
                transactionHash: hash,
                status: 'success',
            })
        })

        it('surfaces a node error fixture', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: {
                        eth_sendRawTransaction: new EvmRpcErrorFixture(
                            -32_000,
                            'nonce too low',
                        ),
                    },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith())

            await expect(
                client.sendRawTransaction({ serializedTransaction: RAW_TX }),
            ).rejects.toThrow(/nonce too low/)
        })
    })

    describe('scope resolution', () => {
        it('targets the scope it was given, not the selected one', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: SEPOLIA_RPC,
                    responses: { eth_chainId: '0xaa36a7' },
                }),
            )
            const client = createEvmClient(SEPOLIA, contextWith())

            expect(client.chain?.id).toBe(11_155_111)
            await expect(client.getChainId()).resolves.toBe(11_155_111)
        })

        it('refuses a network without an RPC URL', () => {
            expect(() =>
                createEvmClient(
                    SEPOLIA,
                    contextWith({ endpoints: { mainnet: MAINNET_RPC } }),
                ),
            ).toThrow(UnconfiguredEvmRpcError)
        })

        it('refuses a scope outside Ethereum', () => {
            expect(() =>
                createEvmClient(
                    { chainId: 'algorand', networkId: 'mainnet' },
                    contextWith(),
                ),
            ).toThrow(UnconfiguredEvmRpcError)
        })
    })

    describe('timeout and retry policy', () => {
        it('bounds a read by the read ceiling but gives a broadcast the submit ceiling', async () => {
            server.use(
                http.post(MAINNET_RPC, async () => {
                    await delay(150)
                }),
                ...evmRpcHandlers({ rpcUrl: MAINNET_RPC }),
            )
            const client = createEvmClient(
                MAINNET,
                contextWith({ timeouts: { readMs: 50, submitMs: 2_000 } }),
            )

            await expect(client.getBlockNumber()).rejects.toBeInstanceOf(
                TimeoutError,
            )
            await expect(
                client.sendRawTransaction({ serializedTransaction: RAW_TX }),
            ).resolves.toBe(keccak256(RAW_TX))
        })

        it('sends a failed request once, leaving retries to the caller', async () => {
            const attempts = vi.fn()
            server.use(
                http.post(MAINNET_RPC, () => {
                    attempts()
                    return new HttpResponse(null, { status: 503 })
                }),
            )
            const client = createEvmClient(MAINNET, contextWith())

            await expect(client.getBlockNumber()).rejects.toThrow()
            expect(attempts).toHaveBeenCalledTimes(1)
        })
    })
})
