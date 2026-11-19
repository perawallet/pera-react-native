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
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { getAddress, type Hex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { upsertAssets } from '@perawallet/wallet-core-assets'
import { isPeraServiceUnavailableError } from '@perawallet/wallet-core-shared'
import { createEthereumAccountStateOps } from '../account-state'
import { createTokenSightings } from '../token-detection'
import { evmNftItem } from '../../assets/api/msw-handlers'
import { peraEvmHandlers } from '../msw-handlers'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
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

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    upsertAssets: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    getAccountHeldAssets: vi.fn().mockResolvedValue([]),
}))

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const NFT_READ_RETRY_MS = 2 * 60_000
const HINT = { priorChainState: undefined }
const FIRST: Hex = '0x00000000000000000000000000000000000000aa'
const SECOND: Hex = '0x00000000000000000000000000000000000000bb'
const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'
const APE = `${getAddress(BAYC)}/1234`
const SWORD = `${getAddress(BAYC)}/7`

const ape = evmNftItem()
const swords = evmNftItem({
    asset_id: `eip155:1/erc1155:${BAYC}/7`,
    standard: 'erc1155',
    balance: '3',
    name: 'Sword',
})

const rpc = () =>
    evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: { eth_blockNumber: '0x64', eth_getBalance: '0x1' },
    })

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => vi.mocked(upsertAssets).mockClear())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchAccountState NFT holdings', () => {
    it('adds every NFT held after the native holding and writes their metadata first', async () => {
        server.use(
            ...rpc(),
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings: { [FIRST]: [[ape], [swords]] },
            }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets', 'nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(
            state.holdings.map(h => [h.assetId, h.amount.toFixed()]),
        ).toEqual([
            ['native', '1'],
            [APE, '1'],
            [SWORD, '3'],
        ])
        expect(state.unrefreshedHoldings).toBeUndefined()
        const { items, scope } = vi.mocked(upsertAssets).mock.calls[0]![0]
        expect(scope).toEqual(SCOPE)
        expect(items.map(asset => asset.assetId)).toEqual([APE, SWORD])
    })

    it('asks nothing of a scope without the nfts service', async () => {
        const requests: string[] = []
        server.events.on('request:start', ({ request }) => {
            requests.push(request.url)
        })
        server.use(...rpc())
        const ops = createEthereumAccountStateOps(testChainContext(), ETHEREUM)

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)
        server.events.removeAllListeners()

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        // Nothing read them, so a stored NFT stays rather than vanishing.
        expect(state.unrefreshedHoldings?.includes(APE)).toBe(true)
        expect(requests.some(url => url.includes('/nfts/'))).toBe(false)
    })

    it("keeps one account's NFT outage to that account", async () => {
        server.use(
            ...rpc(),
            http.get(
                `${TEST_PERA_URL}/api/v3/evm/1/accounts/${SECOND}/nfts/`,
                () =>
                    HttpResponse.json(
                        { code: 'upstream_unavailable' },
                        { status: 502 },
                    ),
            ),
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings: { [FIRST]: [[ape]] },
            }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets', 'nfts'] }),
            ETHEREUM,
            { readWindowMs: 20 },
        )

        const [first, second] = await Promise.all([
            ops.fetchAccountState(FIRST, SCOPE, HINT),
            ops.fetchAccountState(SECOND, SCOPE, HINT),
        ])

        expect(first.holdings.map(h => h.assetId)).toEqual(['native', APE])
        expect(first.unrefreshedHoldings).toBeUndefined()
        expect(second.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(second.nativeBalanceBaseUnits.toFixed()).toBe('1')
        expect(second.unrefreshedHoldings?.includes(APE)).toBe(true)
        expect(
            second.unrefreshedHoldings?.includes(
                '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            ),
        ).toBe(false)
        expect(second.unrefreshedHoldings?.includes('native')).toBe(false)
    })

    it('reports an NFT outage, not the missing token list, as why holdings went unrefreshed', async () => {
        server.use(
            ...rpc(),
            http.get(
                `${TEST_PERA_URL}/api/v3/evm/1/accounts/${FIRST}/nfts/`,
                () =>
                    HttpResponse.json(
                        { code: 'upstream_unavailable' },
                        { status: 502 },
                    ),
            ),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(state.unrefreshedHoldings?.error).toMatchObject({
            status: 502,
        })
    })

    it('reads every page of a cursor-paged list, including an empty page between items', async () => {
        server.use(
            ...rpc(),
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings: { [FIRST]: [[ape], [], [swords]] },
            }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets', 'nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual([
            'native',
            APE,
            SWORD,
        ])
        expect(state.unrefreshedHoldings).toBeUndefined()
    })

    it.each([503, 429])(
        'keeps the stored NFTs, and only them, when the backend answers %s',
        async status => {
            server.use(
                ...rpc(),
                ...peraEvmHandlers({
                    baseUrl: TEST_PERA_URL,
                    nftHoldings: status,
                }),
            )
            const ops = createEthereumAccountStateOps(
                testChainContext({ services: ['assets', 'nfts'] }),
                ETHEREUM,
            )

            const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

            expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
            expect(state.unrefreshedHoldings?.includes(APE)).toBe(true)
            expect(
                state.unrefreshedHoldings?.includes(
                    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                ),
            ).toBe(false)
            expect(state.unrefreshedHoldings?.error).toMatchObject({ status })
        },
    )

    it('treats a chain without NFT reads as a scope without the service', async () => {
        server.use(
            ...rpc(),
            ...peraEvmHandlers({ baseUrl: TEST_PERA_URL, nftHoldings: 422 }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets', 'nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(
            isPeraServiceUnavailableError(state.unrefreshedHoldings?.error),
        ).toBe(true)
        expect(state.unrefreshedHoldings?.includes(APE)).toBe(true)
    })

    it('leaves the NFTs unrefreshed when their metadata cannot be written', async () => {
        vi.mocked(upsertAssets).mockRejectedValueOnce(new Error('disk full'))
        server.use(
            ...rpc(),
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings: { [FIRST]: [[ape]] },
            }),
        )
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets', 'nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(state.unrefreshedHoldings?.error).toEqual(new Error('disk full'))
    })
})

describe('fetchAccountState NFT pages', () => {
    const nftQueries = (): string[] => {
        const queries: string[] = []
        server.events.on('request:start', ({ request }) => {
            const url = new URL(request.url)
            if (url.pathname.endsWith('/nfts/')) queries.push(url.search)
        })
        return queries
    }

    const setup = (
        nftHoldings: Parameters<typeof peraEvmHandlers>[0]['nftHoldings'],
    ) => {
        const clock = { now: 1_000_000 }
        server.use(
            ...rpc(),
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings,
                blockFollowing: { refresh: false },
            }),
        )
        const tokenSightings = createTokenSightings()
        const ops = createEthereumAccountStateOps(
            testChainContext({
                services: ['assets', 'nfts', 'blockFollowing'],
            }),
            ETHEREUM,
            { now: () => clock.now, tokenSightings },
        )
        return { clock, ops, tokenSightings }
    }

    afterEach(() => server.events.removeAllListeners())

    it('reads page one alone on a later sync while it is unchanged, keeping every NFT', async () => {
        const { ops } = setup({ [FIRST]: [[ape], [swords]] })
        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        const queries = nftQueries()

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(queries).toEqual([''])
        expect(state.holdings.map(h => h.assetId)).toEqual([
            'native',
            APE,
            SWORD,
        ])
        expect(state.unrefreshedHoldings).toBeUndefined()
    })

    it('reads every page again after a mined send, and only once', async () => {
        const { ops, tokenSightings } = setup({ [FIRST]: [[ape], [swords]] })
        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        const queries = nftQueries()

        tokenSightings.recordSend(SCOPE, FIRST)
        await expect(
            ops.fetchChangeSignal([FIRST], SCOPE, 100),
        ).resolves.toEqual({ changed: true, cursor: 100 })
        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        expect(queries).toEqual(['', '?cursor=page%3A1'])

        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        expect(queries).toEqual(['', '?cursor=page%3A1', ''])
    })

    it('asks the backend to skip its cache, and reads every page, on a refresh the user asked for', async () => {
        const { ops } = setup({ [FIRST]: [[ape], [swords]] })
        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        const queries = nftQueries()

        await ops.fetchAccountState(FIRST, SCOPE, {
            ...HINT,
            isUserRefresh: true,
        })

        expect(queries).toEqual(['?force_refresh=true', '?cursor=page%3A1'])
    })

    it('never asks to skip the cache on a routine sync', async () => {
        const { ops } = setup({ [FIRST]: [[ape], [swords]] })
        const queries = nftQueries()

        await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(queries).toEqual(['', '?cursor=page%3A1'])
    })

    it('reads the NFTs again two minutes after a 429, with nothing new on chain', async () => {
        const { clock, ops } = setup(429)
        const failed = await ops.fetchAccountState(FIRST, SCOPE, HINT)
        expect(failed.unrefreshedHoldings?.includes(APE)).toBe(true)

        clock.now += NFT_READ_RETRY_MS - 1
        await expect(
            ops.fetchChangeSignal([FIRST], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })

        clock.now += 1
        await expect(
            ops.fetchChangeSignal([FIRST], SCOPE, 100),
        ).resolves.toEqual({ changed: true, cursor: 100 })

        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                nftHoldings: { [FIRST]: [[ape]] },
            }),
        )
        await ops.fetchAccountState(FIRST, SCOPE, HINT)
        await expect(
            ops.fetchChangeSignal([FIRST], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })
    })

    it('asks for no retry on a chain without NFT reads', async () => {
        const { clock, ops } = setup(422)
        await ops.fetchAccountState(FIRST, SCOPE, HINT)

        clock.now += NFT_READ_RETRY_MS
        await expect(
            ops.fetchChangeSignal([FIRST], SCOPE, 100),
        ).resolves.toEqual({ changed: false, cursor: 100 })
    })
})
