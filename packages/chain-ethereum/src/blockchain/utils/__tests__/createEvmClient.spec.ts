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
import {
    createEvmClient,
    splitCeilingMs,
    UnconfiguredEvmRpcError,
} from '../createEvmClient'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
} from '../../msw-handlers'
import { ETHEREUM } from '../../../__tests__/evm-chains'

const MAINNET_RPC = 'https://mainnet.rpc.test/'
const SEPOLIA_RPC = 'https://sepolia.rpc.test/'
const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'
const RAW_TX: Hex = '0x02f86c0180843b9aca00'

const contextWith = ({
    endpoints = { mainnet: [MAINNET_RPC], sepolia: [SEPOLIA_RPC] },
    timeouts = { readMs: 1_000, submitMs: 1_000 },
}: {
    endpoints?: Record<string, readonly string[]>
    timeouts?: ChainContext['timeouts']
} = {}): ChainContext => ({
    getScope: () => MAINNET,
    getEndpoints: () => endpoints,
    getPeraBackend: () => ({ baseUrl: '', services: new Set() }),
    timeouts,
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
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

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
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

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
                reward: [[1_000_000_000n, 1_000_000_000n, 1_000_000_000n]],
            })
        })

        it('returns the eth_call payload', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: { eth_call: '0x2a' },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

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
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

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
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

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
            const client = createEvmClient(SEPOLIA, contextWith(), ETHEREUM)

            expect(client.chain?.id).toBe(11_155_111)
            await expect(client.getChainId()).resolves.toBe(11_155_111)
        })

        it('refuses a network without an RPC URL', () => {
            expect(() =>
                createEvmClient(
                    SEPOLIA,
                    contextWith({ endpoints: { mainnet: [MAINNET_RPC] } }),
                    ETHEREUM,
                ),
            ).toThrow(UnconfiguredEvmRpcError)
        })

        it('refuses a network whose endpoint list is empty', () => {
            expect(() =>
                createEvmClient(
                    MAINNET,
                    contextWith({ endpoints: { mainnet: [] } }),
                    ETHEREUM,
                ),
            ).toThrow(UnconfiguredEvmRpcError)
        })

        it('refuses a scope outside Ethereum', () => {
            expect(() =>
                createEvmClient(
                    { chainId: 'algorand', networkId: 'mainnet' },
                    contextWith(),
                    ETHEREUM,
                ),
            ).toThrow(UnconfiguredEvmRpcError)
        })
    })

    describe('an endpoint list', () => {
        const FIRST_RPC = 'https://first.rpc.test/'
        const SECOND_RPC = 'https://second.rpc.test/'
        const withList = (timeouts = { readMs: 1_000, submitMs: 1_000 }) =>
            contextWith({
                endpoints: { mainnet: [FIRST_RPC, SECOND_RPC] },
                timeouts,
            })
        // Falls through to the node handlers behind it, after counting the call.
        const countCalls = (url: string) => {
            const calls = vi.fn()
            server.use(
                http.post(url, () => {
                    calls()
                    return undefined
                }),
            )
            return calls
        }
        const firstIsDown = () =>
            server.use(http.post(FIRST_RPC, () => HttpResponse.error()))
        // Falls through to the node handlers behind it, after recording how
        // many JSON-RPC entries the request carried.
        const recordBatchSizes = (url: string, sizes: number[]) =>
            http.post(url, async ({ request }) => {
                const body: unknown = await request.clone().json()
                sizes.push(Array.isArray(body) ? body.length : 1)
            })
        const addressAt = (index: number): Hex =>
            `0x${index.toString(16).padStart(40, '0')}`

        it('reads from the first URL alone while it answers', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: { eth_blockNumber: '0x10' },
                }),
                ...evmRpcHandlers({
                    rpcUrl: SECOND_RPC,
                    responses: { eth_blockNumber: '0x20' },
                }),
            )
            const secondCalls = countCalls(SECOND_RPC)
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await expect(client.getBlockNumber()).resolves.toBe(16n)
            expect(secondCalls).not.toHaveBeenCalled()
        })

        it('serves reads from the second URL while the first is unreachable', async () => {
            firstIsDown()
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: SECOND_RPC,
                    responses: {
                        eth_blockNumber: '0x20',
                        eth_getBalance: '0xde0b6b3a7640000',
                        eth_getTransactionCount: '0x7',
                    },
                }),
            )
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await expect(client.getBlockNumber()).resolves.toBe(32n)
            await expect(client.getBalance({ address: ADDRESS })).resolves.toBe(
                10n ** 18n,
            )
            await expect(
                client.getTransactionCount({ address: ADDRESS }),
            ).resolves.toBe(7)
        })

        it('broadcasts through the second URL while the first is unreachable', async () => {
            firstIsDown()
            server.use(...evmRpcHandlers({ rpcUrl: SECOND_RPC }))
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await expect(
                client.sendRawTransaction({ serializedTransaction: RAW_TX }),
            ).resolves.toBe(keccak256(RAW_TX))
        })

        it('fails over from a first URL that answers too slowly, inside the whole ceiling', async () => {
            server.use(
                http.post(FIRST_RPC, async () => {
                    await delay(2_000)
                }),
                ...evmRpcHandlers({ rpcUrl: SECOND_RPC }),
            )
            const client = createEvmClient(
                MAINNET,
                withList({ readMs: 1_200, submitMs: 1_200 }),
                ETHEREUM,
            )
            const startedAt = Date.now()

            await expect(client.getBlockNumber()).resolves.toBeTypeOf('bigint')
            expect(Date.now() - startedAt).toBeLessThan(1_200)
        })

        it('still reads from a slow first URL that answers inside the ceiling the fallback leaves it', async () => {
            // An equal split would cut it off at 500ms.
            server.use(
                http.post(FIRST_RPC, async () => {
                    await delay(600)
                    return undefined
                }),
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: { eth_blockNumber: '0x10' },
                }),
                ...evmRpcHandlers({
                    rpcUrl: SECOND_RPC,
                    responses: { eth_blockNumber: '0x20' },
                }),
            )
            const client = createEvmClient(
                MAINNET,
                withList({ readMs: 1_000, submitMs: 1_000 }),
                ETHEREUM,
            )

            await expect(client.getBlockNumber()).resolves.toBe(16n)
        })

        it('does not take a contract revert to the next URL', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: FIRST_RPC,
                    responses: {
                        eth_call: new EvmRpcErrorFixture(
                            3,
                            'execution reverted',
                        ),
                    },
                }),
                ...evmRpcHandlers({ rpcUrl: SECOND_RPC }),
            )
            const secondCalls = countCalls(SECOND_RPC)
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await expect(
                client.call({ to: ADDRESS, data: '0x70a08231' }),
            ).rejects.toThrow(/revert/i)
            expect(secondCalls).not.toHaveBeenCalled()
        })

        it('tries each URL once, in order, before giving up', async () => {
            const order: string[] = []
            server.use(
                http.post(FIRST_RPC, () => {
                    order.push('first')
                    return HttpResponse.error()
                }),
                http.post(SECOND_RPC, () => {
                    order.push('second')
                    return new HttpResponse(null, { status: 503 })
                }),
            )
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await expect(client.getBlockNumber()).rejects.toThrow()
            expect(order).toEqual(['first', 'second'])
        })

        it('sends the second URL reads in batches of at most ten while the first is unreachable', async () => {
            const sizes: number[] = []
            firstIsDown()
            server.use(
                recordBatchSizes(SECOND_RPC, sizes),
                ...evmRpcHandlers({ rpcUrl: SECOND_RPC }),
            )
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            const counts = await Promise.all(
                Array.from({ length: 25 }, (_, index) =>
                    client.getTransactionCount({ address: addressAt(index) }),
                ),
            )

            expect(counts).toHaveLength(25)
            expect(Math.max(...sizes)).toBeLessThanOrEqual(10)
            expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(25)
        })

        it('still sends the first URL up to a hundred reads in one request', async () => {
            const firstSizes: number[] = []
            const secondCalls = countCalls(SECOND_RPC)
            server.use(
                recordBatchSizes(FIRST_RPC, firstSizes),
                ...evmRpcHandlers({ rpcUrl: FIRST_RPC }),
                ...evmRpcHandlers({ rpcUrl: SECOND_RPC }),
            )
            const client = createEvmClient(MAINNET, withList(), ETHEREUM)

            await Promise.all(
                Array.from({ length: 25 }, (_, index) =>
                    client.getTransactionCount({ address: addressAt(index) }),
                ),
            )

            expect(firstSizes).toEqual([25])
            expect(secondCalls).not.toHaveBeenCalled()
        })
    })

    describe('request size', () => {
        const recordBodySizes = (sizes: number[]) =>
            http.post(MAINNET_RPC, async ({ request }) => {
                sizes.push((await request.clone().text()).length)
            })

        it('sends a large read on its own, so no request body grows past a node limit', async () => {
            const sizes: number[] = []
            server.use(
                recordBodySizes(sizes),
                ...evmRpcHandlers({
                    rpcUrl: MAINNET_RPC,
                    responses: { eth_call: '0x2a' },
                }),
            )
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)
            const data: Hex = `0x${'ab'.repeat(100_000)}`

            await Promise.all(
                Array.from({ length: 8 }, () =>
                    client.call({ to: ADDRESS, data }),
                ),
            )

            expect(sizes).toHaveLength(8)
            expect(Math.max(...sizes)).toBeLessThan(300_000)
        })

        it('still sends small reads issued together as one request', async () => {
            const sizes: number[] = []
            server.use(
                recordBodySizes(sizes),
                ...evmRpcHandlers({ rpcUrl: MAINNET_RPC }),
            )
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

            await Promise.all(
                Array.from({ length: 5 }, () =>
                    client.getTransactionCount({ address: ADDRESS }),
                ),
            )

            expect(sizes).toHaveLength(1)
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
                ETHEREUM,
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
            const client = createEvmClient(MAINNET, contextWith(), ETHEREUM)

            await expect(client.getBlockNumber()).rejects.toThrow()
            expect(attempts).toHaveBeenCalledTimes(1)
        })
    })
})

describe('splitCeilingMs', () => {
    it('gives a lone URL the whole ceiling', () => {
        expect(splitCeilingMs(15_000, 1)).toEqual([15_000])
    })

    it('leaves the first URL the ceiling less a capped reserve for the fallback', () => {
        expect(splitCeilingMs(15_000, 2)).toEqual([12_000, 3_000])
        expect(splitCeilingMs(30_000, 2)).toEqual([27_000, 3_000])
    })

    it('shrinks the reserve with a small ceiling and never reaches zero', () => {
        expect(splitCeilingMs(1_000, 2)).toEqual([750, 250])
        expect(splitCeilingMs(2, 2)).toEqual([1, 1])
    })

    it('never spends more than the ceiling in total', () => {
        for (const ms of [1_000, 15_000, 30_000]) {
            const total = splitCeilingMs(ms, 2).reduce((a, b) => a + b, 0)
            expect(total).toBeLessThanOrEqual(ms)
        }
    })
})
