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
import {
    encodeAbiParameters,
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
import { readErc20, readErc20TotalSupply } from '../erc20'
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
