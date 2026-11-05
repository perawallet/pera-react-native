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
import {
    encodeAbiParameters,
    encodeFunctionResult,
    getAddress,
    isAddressEqual,
    multicall3Abi,
    stringToHex,
    toFunctionSelector,
    type Hex,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    isPeraNetworkError,
    isTransientNetworkError,
} from '@perawallet/wallet-core-shared'
import { TEST_RPC_URL, testChainContext } from '../../../__tests__/context'
import {
    MULTICALL3_ADDRESS,
    readBalances,
    readErc20,
    readErc20Decimals,
    readErc20TotalSupply,
} from '../erc20'
import { createEvmClient } from '../createEvmClient'
import {
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
} from '../../msw-handlers'
import { ETHEREUM } from '../../../__tests__/evm-chains'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const usdcResponder = erc20CallResponder({
    [USDC]: {
        name: 'USD Coin',
        symbol: 'USDC',
        decimals: 6,
        totalSupply: 10n ** 12n,
    },
})
const server = setupServer(
    ...evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: { eth_call: usdcResponder },
    }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('readErc20', () => {
    it("reads the token's metadata as an unverified PeraAsset with a checksummed id", async () => {
        const asset = await readErc20(
            testChainContext(),
            ETHEREUM,
            USDC.toLowerCase(),
            SCOPE,
        )

        expect(asset).toMatchObject({
            assetId: USDC,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
            peraMetadata: { verificationTier: 'unverified' },
        })
        expect(asset.totalSupply.toFixed()).toBe('1000000000000')
        // Left unset so persisting the read keeps the user's own flags.
        expect(asset.peraMetadata).not.toHaveProperty('isFavorited')
        expect(asset.peraMetadata).not.toHaveProperty('isPriceAlertEnabled')
    })

    it('rejects when the contract reverts', async () => {
        await expect(
            readErc20(
                testChainContext(),
                ETHEREUM,
                '0x00000000000000000000000000000000000000cc',
                SCOPE,
            ),
        ).rejects.toThrow()
    })

    // MKR and SAI declare name() and symbol() as bytes32.
    it('reads a token whose name and symbol are right-padded bytes32', async () => {
        const MKR = '0x00000000000000000000000000000000000000dd'
        const answers: Record<string, Hex> = {
            [toFunctionSelector('name()')]: stringToHex('Maker', { size: 32 }),
            [toFunctionSelector('symbol()')]: stringToHex('MKR', { size: 32 }),
            [toFunctionSelector('decimals()')]: encodeAbiParameters(
                [{ type: 'uint8' }],
                [18],
            ),
            [toFunctionSelector('totalSupply()')]: encodeAbiParameters(
                [{ type: 'uint256' }],
                [10n ** 24n],
            ),
        }
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: params => {
                        const { data } = params[0] as { data: Hex }
                        return (
                            answers[data.slice(0, 10)] ??
                            new EvmRpcErrorFixture(3, 'execution reverted')
                        )
                    },
                },
            }),
        )

        const asset = await readErc20(testChainContext(), ETHEREUM, MKR, SCOPE)

        expect(asset).toMatchObject({
            name: 'Maker',
            unitName: 'MKR',
            decimals: 18,
        })
        expect(asset.totalSupply.toFixed()).toBe((10n ** 24n).toString())
    })

    it('rejects with the original error when the string and bytes32 reads both revert', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: () => new EvmRpcErrorFixture(3, 'token exploded'),
                },
            }),
        )

        await expect(
            readErc20(
                testChainContext(),
                ETHEREUM,
                '0x00000000000000000000000000000000000000ee',
                SCOPE,
            ),
        ).rejects.toThrow(/token exploded/)
    })

    it('rejects when the string read fails at the node, rather than retrying it as bytes32', async () => {
        const NAME = toFunctionSelector('name()')
        let nameReads = 0
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: params => {
                        const { data } = params[0] as { data: Hex }
                        if (data.startsWith(NAME) && nameReads++ === 0) {
                            return new EvmRpcErrorFixture(
                                -32000,
                                'header not found',
                            )
                        }
                        return usdcResponder(params)
                    },
                },
            }),
        )

        await expect(
            readErc20(testChainContext(), ETHEREUM, USDC, SCOPE),
        ).rejects.toThrow(/header not found/)
        expect(nameReads).toBe(1)
    })
})

describe('readErc20TotalSupply', () => {
    it("reads only the contract's total supply, in base units, with one call", async () => {
        const calls: string[] = []
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: params => {
                        calls.push((params[0] as { data: Hex }).data)
                        return usdcResponder(params)
                    },
                },
            }),
        )

        const supply = await readErc20TotalSupply(
            testChainContext(),
            ETHEREUM,
            USDC.toLowerCase(),
            SCOPE,
        )

        expect(supply.toFixed()).toBe('1000000000000')
        expect(calls).toEqual([toFunctionSelector('totalSupply()')])
    })

    it('reads zero when the contract reverts, which the screen shows as unknown', async () => {
        const supply = await readErc20TotalSupply(
            testChainContext(),
            ETHEREUM,
            '0x00000000000000000000000000000000000000cc',
            SCOPE,
        )

        expect(supply.isZero()).toBe(true)
    })

    it('reads zero from an address with no contract code', async () => {
        const NO_CODE = '0x00000000000000000000000000000000000000dd'
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: erc20CallResponder({
                        [NO_CODE]: {
                            name: '',
                            symbol: '',
                            decimals: 0,
                            totalSupply: 0n,
                            noCode: true,
                        },
                    }),
                },
            }),
        )

        const supply = await readErc20TotalSupply(
            testChainContext(),
            ETHEREUM,
            NO_CODE,
            SCOPE,
        )

        expect(supply.isZero()).toBe(true)
    })

    it('rejects with a transient network error when the node rate-limits the call', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: new EvmRpcErrorFixture(-32005, 'limit exceeded'),
                },
            }),
        )

        const error = await readErc20TotalSupply(
            testChainContext(),
            ETHEREUM,
            USDC,
            SCOPE,
        ).catch((reason: unknown) => reason)

        expect(isPeraNetworkError(error)).toBe(true)
        expect(isTransientNetworkError(error)).toBe(true)
    })

    it.each([
        ['a 503 from the node', () => new HttpResponse(null, { status: 503 })],
        ['a failed connection', () => HttpResponse.error()],
    ])(
        'rejects with a transient network error on %s',
        async (_label, respond) => {
            server.use(http.post(TEST_RPC_URL, respond))

            const error = await readErc20TotalSupply(
                testChainContext(),
                ETHEREUM,
                USDC,
                SCOPE,
            ).catch((reason: unknown) => reason)

            expect(isTransientNetworkError(error)).toBe(true)
        },
    )

    it("rejects a node's refusal of the request as it is, not as a transient failure", async () => {
        server.use(
            http.post(
                TEST_RPC_URL,
                () => new HttpResponse(null, { status: 401 }),
            ),
        )

        const error = await readErc20TotalSupply(
            testChainContext(),
            ETHEREUM,
            USDC,
            SCOPE,
        ).catch((reason: unknown) => reason)

        expect(error).toBeInstanceOf(Error)
        expect(isTransientNetworkError(error)).toBe(false)
    })
})

describe('readErc20Decimals', () => {
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    const client = () => createEvmClient(SCOPE, testChainContext(), ETHEREUM)

    it("reads each token's decimals in one aggregate3 call, keyed by checksummed contract", async () => {
        const targets: string[] = []
        server.use(
            http.post(TEST_RPC_URL, async ({ request }) => {
                const body: unknown = await request.clone().json()
                const items = (Array.isArray(body) ? body : [body]) as {
                    method: string
                    params: { to: string }[]
                }[]
                for (const item of items) {
                    if (item.method === 'eth_call') {
                        targets.push(item.params[0]!.to)
                    }
                }
                return undefined
            }),
        )

        const decimals = await readErc20Decimals(client(), [USDC.toLowerCase()])

        expect(decimals).toEqual(new Map([[USDC, 6]]))
        expect(targets).toHaveLength(1)
        expect(isAddressEqual(targets[0] as Hex, MULTICALL3_ADDRESS)).toBe(true)
    })

    it('leaves out a token that reverts or has no code', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: erc20CallResponder({
                        [USDC]: {
                            name: 'USD Coin',
                            symbol: 'USDC',
                            decimals: 6,
                            totalSupply: 1n,
                        },
                        [DAI]: {
                            name: 'Dai',
                            symbol: 'DAI',
                            decimals: 18,
                            totalSupply: 1n,
                            noCode: true,
                        },
                    }),
                },
            }),
        )

        const decimals = await readErc20Decimals(client(), [
            USDC,
            DAI,
            '0x0000000000000000000000000000000000000001',
        ])

        expect(decimals).toEqual(new Map([[USDC, 6]]))
    })

    it('rejects when the aggregate fails', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: new EvmRpcErrorFixture(
                        -32_000,
                        'header not found',
                    ),
                },
            }),
        )

        await expect(readErc20Decimals(client(), [USDC])).rejects.toThrow()
    })

    it('pairs each token with its own answer across aggregate chunks', async () => {
        const tokens = Array.from(
            { length: 301 },
            (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
        ).map(id => getAddress(id))
        const fixtures = Object.fromEntries(
            tokens.map((token, index) => [
                token,
                {
                    name: 'T',
                    symbol: 'T',
                    decimals: index % 19,
                    totalSupply: 1n,
                },
            ]),
        )
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: { eth_call: erc20CallResponder(fixtures) },
            }),
        )

        const decimals = await readErc20Decimals(client(), tokens)

        expect(decimals.size).toBe(301)
        tokens.forEach((token, index) =>
            expect(decimals.get(token)).toBe(index % 19),
        )
    })

    // Answers each JSON-RPC eth_call by its target: `reply` returns a hex result
    // or null for an execution revert.
    const serveCalls = (reply: (to: Hex) => Hex | null) =>
        server.use(
            http.post(TEST_RPC_URL, async ({ request }) => {
                const body: unknown = await request.clone().json()
                const items = (Array.isArray(body) ? body : [body]) as {
                    id: number
                    params: { to: Hex }[]
                }[]
                const replies = items.map(({ id, params }) => {
                    const result = reply(params[0]!.to)
                    return result === null
                        ? {
                              jsonrpc: '2.0',
                              id,
                              error: { code: 3, message: 'execution reverted' },
                          }
                        : { jsonrpc: '2.0', id, result }
                })
                return HttpResponse.json(
                    Array.isArray(body) ? replies : replies[0],
                )
            }),
        )
    const isMulticall = (to: Hex) => isAddressEqual(to, MULTICALL3_ADDRESS)
    const word = (value: bigint) =>
        encodeAbiParameters([{ type: 'uint256' }], [value])

    it('rejects when the aggregate answers fewer results than calls', async () => {
        serveCalls(to =>
            isMulticall(to)
                ? encodeFunctionResult({
                      abi: multicall3Abi,
                      functionName: 'aggregate3',
                      result: [{ success: true, returnData: '0x' }],
                  })
                : null,
        )

        await expect(readErc20Decimals(client(), [USDC, DAI])).rejects.toThrow(
            'Multicall3 answered 1 of 2 calls',
        )
    })

    it('reads the other tokens on their own when one contract fails the whole aggregate', async () => {
        serveCalls(to =>
            isMulticall(to) || isAddressEqual(to, DAI) ? null : word(6n),
        )

        const decimals = await readErc20Decimals(client(), [USDC, DAI])

        expect(decimals).toEqual(new Map([[USDC, 6]]))
    })

    it('leaves out a token whose decimals are not a uint8', async () => {
        serveCalls(to =>
            isMulticall(to)
                ? encodeFunctionResult({
                      abi: multicall3Abi,
                      functionName: 'aggregate3',
                      result: [
                          { success: true, returnData: word(6n) },
                          { success: true, returnData: word(256n) },
                      ],
                  })
                : null,
        )

        const decimals = await readErc20Decimals(client(), [USDC, DAI])

        expect(decimals).toEqual(new Map([[USDC, 6]]))
    })
})

describe('readBalances', () => {
    const HOLDER = '0x00000000000000000000000000000000000000aa'
    // Enough tokens for ten aggregate chunks of 300 calls.
    const TOKENS = Array.from(
        { length: 2_999 },
        (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
    )

    const trackEthCallsInFlight = (track: {
        inFlight: number
        peak: number
        total: number
    }) =>
        http.post(TEST_RPC_URL, async ({ request }) => {
            const body = (await request.clone().json()) as { method?: string }
            if (body.method !== 'eth_call') return
            track.total += 1
            track.inFlight += 1
            track.peak = Math.max(track.peak, track.inFlight)
            await delay(20)
            track.inFlight -= 1
        })

    it('keeps at most four aggregate calls in flight for a long token list', async () => {
        const track = { inFlight: 0, peak: 0, total: 0 }
        server.use(
            trackEthCallsInFlight(track),
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: usdcResponder,
                    eth_getBalance: '0x2a',
                },
            }),
        )
        const client = createEvmClient(SCOPE, testChainContext(), ETHEREUM)

        const balances = await readBalances(client, [HOLDER], TOKENS, 1n)

        expect(balances.get(getAddress(HOLDER))?.wei).toBe(42n)
        expect(track.total).toBe(10)
        expect(track.peak).toBeLessThanOrEqual(4)
    })

    it('starts no further aggregate call once one has failed', async () => {
        const track = { inFlight: 0, peak: 0, total: 0 }
        server.use(
            trackEthCallsInFlight(track),
            http.post(
                TEST_RPC_URL,
                () => new HttpResponse(null, { status: 503 }),
            ),
        )
        const client = createEvmClient(SCOPE, testChainContext(), ETHEREUM)

        await expect(
            readBalances(client, [HOLDER], TOKENS, 1n),
        ).rejects.toThrow()
        expect(track.total).toBeLessThanOrEqual(4)
    })

    it("rejects with an error that carries none of the chunk's calldata", async () => {
        server.use(
            http.post(
                TEST_RPC_URL,
                () => new HttpResponse(null, { status: 503 }),
            ),
        )
        const client = createEvmClient(SCOPE, testChainContext(), ETHEREUM)

        const error = await readBalances(client, [HOLDER], TOKENS, 1n).catch(
            (reason: unknown) => reason,
        )

        expect(error).toBeInstanceOf(Error)
        expect(String((error as Error).message)).toContain(
            'HTTP request failed',
        )
        expect(JSON.stringify(error)).not.toContain(HOLDER.slice(2))
        expect((error as Error).message).not.toContain(HOLDER.slice(2))
        expect((error as Error).message).not.toContain(TOKENS[0]!.slice(2))
    })
})
