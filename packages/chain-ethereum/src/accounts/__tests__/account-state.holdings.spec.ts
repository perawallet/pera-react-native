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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { createEthereumAccountStateOps } from '../account-state'
import type { WhitelistItemResponse } from '../../assets/api/schema'
import {
    nativeWhitelistItem,
    unknownAssetItem,
} from '../../assets/api/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'
import {
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type Erc20Fixture,
    type EvmRpcResponder,
} from '../../blockchain/msw-handlers'
import {
    TEST_PERA_URL,
    TEST_RPC_URL,
    testChainContext,
} from '../../__tests__/context'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'
const HOLDER = getAddress(ADDRESS)
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const BROKEN = '0x00000000000000000000000000000000000000cc'
const NO_CODE = '0x00000000000000000000000000000000000000dd'
const SHORT = '0x00000000000000000000000000000000000000ee'
const HINT = { priorResourceCount: 0 }

const listed = (address: string): WhitelistItemResponse => {
    const caip19 = `eip155:1/erc20:${address.toLowerCase()}`
    return {
        ...unknownAssetItem(caip19),
        type: 'erc20',
        fraction_decimals: 6,
        is_swappable: true,
        is_fundable: false,
    }
}

const token = (balance: bigint): Erc20Fixture => ({
    name: 'Token',
    symbol: 'TKN',
    decimals: 6,
    totalSupply: 10n ** 12n,
    balances: { [HOLDER]: balance },
})

const rpcAtBlock = (
    block: Hex,
    ethCall: EvmRpcResponder<'eth_call'> = erc20CallResponder({}),
) =>
    evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: {
            eth_blockNumber: block,
            eth_getBalance: '0x1',
            eth_call: ethCall,
        },
    })

const whitelist = (...addresses: string[]) =>
    peraEvmHandlers({
        baseUrl: TEST_PERA_URL,
        whitelist: { 1: [nativeWhitelistItem(1), ...addresses.map(listed)] },
    })

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchAccountState token holdings', () => {
    it('appends non-zero whitelisted balances after the native holding', async () => {
        server.use(
            ...rpcAtBlock(
                '0x64',
                erc20CallResponder({
                    [USDC]: token(9_007_199_254_740_993n),
                    [DAI]: token(0n),
                }),
            ),
            ...whitelist(USDC, DAI),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native', USDC])
        expect(state.holdings[1]!.amount.toFixed()).toBe('9007199254740993')
        expect(state.holdings[1]!.isFrozen).toBe(false)
        expect(state.observedRound).toBe(100)
    })

    it('leaves out a token whose balance read reverts', async () => {
        server.use(
            ...rpcAtBlock('0x64', erc20CallResponder({ [USDC]: token(5n) })),
            ...whitelist(BROKEN, USDC),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native', USDC])
    })

    it('leaves out a token whose call succeeds with no or truncated return data', async () => {
        server.use(
            ...rpcAtBlock(
                '0x64',
                erc20CallResponder({
                    [NO_CODE]: { ...token(5n), noCode: true },
                    [SHORT]: { ...token(5n), shortReturn: true },
                    [USDC]: token(5n),
                }),
            ),
            ...whitelist(NO_CODE, SHORT, USDC),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native', USDC])
    })

    it('reads the holdings of the usable whitelist rows when others are not', async () => {
        const row = listed(DAI)
        server.use(
            ...rpcAtBlock(
                '0x64',
                erc20CallResponder({ [USDC]: token(5n), [DAI]: token(7n) }),
            ),
            http.get(`${TEST_PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({
                    results: [
                        nativeWhitelistItem(1),
                        {
                            ...row,
                            asset_id: `eip155:1/erc721:${BROKEN}`,
                            type: 'erc721',
                        },
                        { ...row, asset_id: 'eip155:1/erc20:not-an-address' },
                        { ...row, verification_tier: 'trusted' },
                        listed(USDC),
                    ],
                }),
            ),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native', USDC])
    })

    it('rejects the whole read when the whitelist results is not a list', async () => {
        server.use(
            ...rpcAtBlock('0x64'),
            http.get(`${TEST_PERA_URL}/api/v3/evm/:chainId/tokens/`, () =>
                HttpResponse.json({ results: null }),
            ),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, HINT),
        ).rejects.toThrow()
    })

    it('reads every balance in one call pinned to the read block', async () => {
        const blocks: unknown[] = []
        const responder = erc20CallResponder({
            [USDC]: token(5n),
            [DAI]: token(7n),
        })
        server.use(
            ...rpcAtBlock('0x64', params => {
                blocks.push(params[1])
                return responder(params)
            }),
            ...whitelist(USDC, DAI),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(blocks).toEqual(['0x64'])
    })

    it('makes no balance call when the whitelist lists no tokens', async () => {
        const calls: unknown[] = []
        server.use(
            ...rpcAtBlock('0x64', params => {
                calls.push(params)
                return '0x'
            }),
            ...peraEvmHandlers({ baseUrl: TEST_PERA_URL }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(calls).toEqual([])
    })

    it('reads the native holding only, with no backend request or balance call, without the assets service', async () => {
        const calls: unknown[] = []
        server.use(
            ...rpcAtBlock('0x64', params => {
                calls.push(params)
                return '0x'
            }),
        )
        const ctx = testChainContext()
        const ops = createEthereumAccountStateOps(ctx)

        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(state.observedRound).toBe(100)
        expect(calls).toEqual([])
    })

    it('rejects the whole read when the whitelist request fails', async () => {
        server.use(
            ...rpcAtBlock('0x64'),
            ...peraEvmHandlers({ baseUrl: TEST_PERA_URL, whitelist: 422 }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, HINT),
        ).rejects.toBeInstanceOf(PeraNetworkError)
    })

    it('rejects the whole read when the balance call fails', async () => {
        server.use(
            ...rpcAtBlock(
                '0x64',
                new EvmRpcErrorFixture(-32_000, 'header not found'),
            ),
            ...whitelist(USDC),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, HINT),
        ).rejects.toThrow()
    })
})

describe('fetchAccountState whitelist reuse', () => {
    const WHITELIST_TTL_MS = 60_000
    const OTHER: Hex = '0x00000000000000000000000000000000000000ab'

    const countedWhitelist = (statuses: number[] = []) => {
        const requests = { count: 0 }
        server.use(
            ...rpcAtBlock('0x64', erc20CallResponder({ [USDC]: token(5n) })),
            http.get(`${TEST_PERA_URL}/api/v3/evm/:chainId/tokens/`, () => {
                const status = statuses[requests.count] ?? 200
                requests.count += 1
                return status === 200
                    ? HttpResponse.json({
                          results: [nativeWhitelistItem(1), listed(USDC)],
                      })
                    : HttpResponse.json({}, { status })
            }),
        )
        return requests
    }

    it('shares one whitelist request between concurrent reads of the scope', async () => {
        const requests = countedWhitelist()
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const states = await Promise.all([
            ops.fetchAccountState(ADDRESS, SCOPE, HINT),
            ops.fetchAccountState(OTHER, SCOPE, HINT),
        ])

        expect(requests.count).toBe(1)
        expect(states[0].holdings.map(h => h.assetId)).toEqual(['native', USDC])
    })

    it('reuses the whitelist within the window and refetches after it', async () => {
        const requests = countedWhitelist()
        let now = 1_000_000
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
            { now: () => now },
        )

        await ops.fetchAccountState(ADDRESS, SCOPE, HINT)
        now += WHITELIST_TTL_MS - 1
        await ops.fetchAccountState(OTHER, SCOPE, HINT)
        expect(requests.count).toBe(1)

        now += 1
        await ops.fetchAccountState(ADDRESS, SCOPE, HINT)
        expect(requests.count).toBe(2)
    })

    it('retries a failed whitelist request on the next read', async () => {
        const requests = countedWhitelist([422])
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        await expect(
            ops.fetchAccountState(ADDRESS, SCOPE, HINT),
        ).rejects.toBeInstanceOf(PeraNetworkError)
        const state = await ops.fetchAccountState(ADDRESS, SCOPE, HINT)

        expect(requests.count).toBe(2)
        expect(state.holdings.map(h => h.assetId)).toEqual(['native', USDC])
    })
})
