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
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { getAddress, type Hex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { cachedWhitelist } from '../../assets/api/whitelist-cache'
import {
    evmNftItem,
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import type { WhitelistItemResponse } from '../../assets/api/schema'
import {
    evmHistoryItem,
    evmNftTransferLeg,
} from '../../history/api/msw-handlers'
import { createEthereumAccountStateOps } from '../account-state'
import { peraEvmHandlers } from '../msw-handlers'
import {
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type Erc20Fixture,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['nfts'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const QUIET: Hex = '0x00000000000000000000000000000000000000aa'
const OTHER: Hex = '0x00000000000000000000000000000000000000bb'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const TOKEN_LEG = {
    asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
    contract: USDC.toLowerCase(),
    from: OTHER,
    to: QUIET,
    value: '1000000',
    token_name: 'USD Coin',
    token_symbol: 'USDC',
    token_decimals: 6,
}

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const rpc = (nonce: Hex = '0x0', ethCall = erc20CallResponder({})) =>
    evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: {
            eth_getBalance: '0x0',
            eth_getTransactionCount: nonce,
            eth_blockNumber: '0x64',
            eth_call: ethCall,
        },
    })

const checkWith = (services: string[]) =>
    createEthereumAccountStateOps(testChainContext({ services }), ETHEREUM, {
        listedTokens: cachedWhitelist(ETHEREUM),
    }).checkActivity

const listedUsdc = (): WhitelistItemResponse => ({
    ...unknownAssetItem(`eip155:1/erc20:${USDC.toLowerCase()}`),
    type: 'erc20',
    fraction_decimals: 6,
    is_swappable: true,
    is_fundable: false,
})

const usdc = (balance: bigint): Erc20Fixture => ({
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    totalSupply: 10n ** 12n,
    balances: { [getAddress(QUIET)]: balance },
})

type Seen = { url: URL }
const recordPera = (): Seen[] => {
    const seen: Seen[] = []
    server.use(
        http.get(`${TEST_PERA_URL}/*`, ({ request }) => {
            seen.push({ url: new URL(request.url) })
            return undefined
        }),
    )
    return seen
}

describe('createEvmActivityCheck', () => {
    describe('with a history service', () => {
        it('counts an address that only received an ERC-20', async () => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: {
                        [QUIET]: [
                            [evmHistoryItem({ token_transfers: [TOKEN_LEG] })],
                        ],
                    },
                }),
            )

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active).toEqual(new Map([[QUIET, true]]))
        })

        it('counts an address that only received an NFT', async () => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: {
                        [QUIET]: [
                            [
                                evmHistoryItem({
                                    nft_transfers: [evmNftTransferLeg()],
                                }),
                            ],
                        ],
                    },
                }),
            )

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
        })

        it('counts a token received and later moved out by a spender', async () => {
            const moved = { ...TOKEN_LEG, from: QUIET, to: OTHER }
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: {
                        [QUIET]: [
                            [
                                evmHistoryItem({ token_transfers: [moved] }),
                                evmHistoryItem({
                                    token_transfers: [TOKEN_LEG],
                                }),
                            ],
                        ],
                    },
                }),
            )

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
        })

        it('reads an address with an empty history as inactive', async () => {
            server.use(...rpc(), ...peraEvmHandlers({ baseUrl: TEST_PERA_URL }))

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active).toEqual(new Map([[QUIET, false]]))
        })

        it('makes no history request for an address with a nonce', async () => {
            server.use(
                ...rpc('0x1'),
                ...peraEvmHandlers({ baseUrl: TEST_PERA_URL }),
            )
            const seen = recordPera()

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
            expect(seen).toEqual([])
        })

        it('makes one limit=1 history GET per quiet address and never follows a cursor', async () => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: { [QUIET]: [[], [evmHistoryItem()]] },
                }),
            )
            const seen = recordPera()

            await checkWith(['history'])([QUIET, OTHER], SCOPE)

            expect(seen).toHaveLength(2)
            for (const { url } of seen) {
                expect(url.searchParams.get('limit')).toBe('1')
                expect(url.searchParams.has('cursor')).toBe(false)
            }
        })

        it('counts an address whose only page is empty but carries a cursor', async () => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: { [QUIET]: [[], [evmHistoryItem()]] },
                }),
            )

            const active = await checkWith(['history'])([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
        })

        it('leaves out an address whose history read was rate limited and keeps the others', async () => {
            server.use(
                http.get(
                    `${TEST_PERA_URL}/api/v3/evm/:chainId/accounts/${QUIET}/transactions/`,
                    () => HttpResponse.json({}, { status: 429 }),
                ),
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    history: {
                        [OTHER]: [
                            [evmHistoryItem({ token_transfers: [TOKEN_LEG] })],
                        ],
                    },
                }),
            )

            const active = await checkWith(['history'])([QUIET, OTHER], SCOPE)

            expect(active).toEqual(new Map([[OTHER, true]]))
        })
    })

    describe('without a history service', () => {
        it('counts a listed ERC-20 balance with one aggregate3 call', async () => {
            const calls: string[] = []
            server.use(
                ...rpc('0x0', erc20CallResponder({ [USDC]: usdc(5n) })),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    whitelist: { 1: [nativeWhitelistItem(1), listedUsdc()] },
                }),
            )

            server.use(
                http.post(TEST_RPC_URL, async ({ request }) => {
                    const body: unknown = await request.clone().json()
                    const items = (Array.isArray(body) ? body : [body]) as {
                        method: string
                        params: { to?: string }[]
                    }[]
                    calls.push(
                        ...items
                            .filter(item => item.method === 'eth_call')
                            .map(item => String(item.params[0]?.to)),
                    )
                    return undefined
                }),
            )

            const active = await checkWith(['assets'])([QUIET, OTHER], SCOPE)

            expect(active).toEqual(
                new Map([
                    [QUIET, true],
                    [OTHER, false],
                ]),
            )
            expect(calls).toHaveLength(1)
        })

        it('counts an address whose first NFT page has a row and never asks for the second', async () => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    nftHoldings: { [QUIET]: [[evmNftItem()], [evmNftItem()]] },
                }),
            )
            const seen = recordPera()

            const active = await checkWith(['nfts'])([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
            expect(seen).toHaveLength(1)
            expect(seen[0]!.url.searchParams.has('cursor')).toBe(false)
        })

        it('reads only the node when no Pera service is listed', async () => {
            server.use(...rpc())

            const active = await checkWith([])([QUIET], SCOPE)

            expect(active).toEqual(new Map([[QUIET, false]]))
        })

        it('rejects when every footprint read fails and no token source answers', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_getBalance: new EvmRpcErrorFixture(
                            -32_000,
                            'offline',
                        ),
                        eth_getTransactionCount: '0x0',
                    },
                }),
            )

            await expect(checkWith([])([QUIET, OTHER], SCOPE)).rejects.toThrow()
        })

        it('leaves out an address whose footprint failed and no token source found', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    responses: {
                        eth_getBalance: params =>
                            String(params[0]).toLowerCase() === OTHER
                                ? new EvmRpcErrorFixture(-32_000, 'flaky')
                                : '0x1',
                        eth_getTransactionCount: '0x0',
                    },
                }),
            )

            const active = await checkWith([])([QUIET, OTHER], SCOPE)

            expect(active).toEqual(new Map([[QUIET, true]]))
        })
    })
})
