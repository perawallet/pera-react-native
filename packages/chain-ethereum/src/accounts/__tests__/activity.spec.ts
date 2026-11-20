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
import {
    isChainRefusedError,
    isPeraNetworkError,
    isTransientNetworkError,
} from '@perawallet/wallet-core-shared'
import { whitelistPath } from '../../assets/api/endpoints'
import { cachedWhitelist } from '../../assets/api/whitelist-cache'
import {
    evmNftItem,
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import type { WhitelistItemResponse } from '../../assets/api/schema'
import { evmHistoryItem } from '../../history/api/msw-handlers'
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

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
    server.resetHandlers()
    vi.useRealTimers()
})
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
    describe('Pera reads', () => {
        const ALL = ['history', 'assets', 'nfts']

        it('reads neither history nor NFT holdings, deciding a quiet address from its listed tokens', async () => {
            server.use(
                ...rpc('0x0', erc20CallResponder({ [USDC]: usdc(5n) })),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    whitelist: { 1: [nativeWhitelistItem(1), listedUsdc()] },
                    history: { [OTHER]: [[evmHistoryItem()]] },
                    nftHoldings: { [OTHER]: [[evmNftItem()]] },
                }),
            )
            const seen = recordPera()

            const active = await checkWith(ALL)([QUIET, OTHER], SCOPE)

            expect(active).toEqual(
                new Map([
                    [QUIET, true],
                    [OTHER, false],
                ]),
            )
            expect(
                seen.filter(({ url }) =>
                    /\/(transactions|nfts)\/$/.test(url.pathname),
                ),
            ).toEqual([])
        })

        it('makes no Pera request for an address with a nonce', async () => {
            server.use(
                ...rpc('0x1'),
                ...peraEvmHandlers({ baseUrl: TEST_PERA_URL }),
            )
            const seen = recordPera()

            const active = await checkWith(ALL)([QUIET], SCOPE)

            expect(active.get(QUIET)).toBe(true)
            expect(seen).toEqual([])
        })

        it('rejects with the refusal when the backend has the chain switched off', async () => {
            server.use(
                http.get(`${TEST_PERA_URL}${whitelistPath(':chainId')}`, () =>
                    HttpResponse.json(
                        {
                            code: 'chain_not_enabled',
                            error: 'Chain 1 is not enabled.',
                        },
                        { status: 422 },
                    ),
                ),
                ...rpc(),
            )

            // The query client remembers a refused scope for the rest of the
            // run, so this one refuses a scope no other test uses.
            const error = await checkWith(ALL)([QUIET, OTHER], {
                chainId: 'ethereum',
                networkId: 'sepolia',
            }).catch((rejected: unknown) => rejected)

            expect(isChainRefusedError(error)).toBe(true)
        })

        it('rejects a scope its deployment refuses as refused, asking nothing', async () => {
            const requested: string[] = []
            server.events.on('request:start', ({ request }) => {
                requested.push(request.url)
            })

            const error = await createEthereumAccountStateOps(
                testChainContext({ isChainRefused: true }),
                ETHEREUM,
                { listedTokens: cachedWhitelist(ETHEREUM) },
            )
                .checkActivity([QUIET], {
                    chainId: 'ethereum',
                    networkId: 'mainnet',
                })
                .catch((rejected: unknown) => rejected)
            server.events.removeAllListeners('request:start')

            expect(isChainRefusedError(error)).toBe(true)
            expect(requested).toEqual([])
        })
    })

    describe('token and node reads', () => {
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

        it.each([
            ['HTTP 429', () => new HttpResponse(null, { status: 429 }), 429],
            ['HTTP 503', () => new HttpResponse(null, { status: 503 }), 503],
            ['a dropped connection', () => HttpResponse.error(), undefined],
        ])(
            'rejects with a transient network error when the node answers every footprint read with %s',
            async (_, respond, status) => {
                server.use(http.post(TEST_RPC_URL, respond))

                const error = await checkWith([])([QUIET, OTHER], SCOPE).then(
                    () => undefined,
                    (reason: unknown) => reason,
                )

                expect(isTransientNetworkError(error)).toBe(true)
                if (status !== undefined) {
                    expect(isPeraNetworkError(error) && error.status).toBe(
                        status,
                    )
                }
            },
        )

        it("gives up on a node that never answers within the discovery read ceiling, under the context's own larger read timeout", async () => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
            server.use(http.post(TEST_RPC_URL, () => new Promise(() => {})))
            const ops = createEthereumAccountStateOps(
                {
                    ...testChainContext(),
                    timeouts: { readMs: 15_000, submitMs: 15_000 },
                },
                ETHEREUM,
                { listedTokens: cachedWhitelist(ETHEREUM) },
            )

            const check = ops.checkActivity([QUIET], SCOPE).then(
                () => undefined,
                (reason: unknown) => reason,
            )
            await vi.advanceTimersByTimeAsync(5000)
            const error = await check

            expect(isTransientNetworkError(error)).toBe(true)
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
