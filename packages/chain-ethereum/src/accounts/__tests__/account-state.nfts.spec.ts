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
import { createEthereumAccountStateOps } from '../account-state'
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

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
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
            testChainContext({ services: ['nfts'] }),
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
        expect(state.unrefreshedHoldings).toBeUndefined()
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
            testChainContext({ services: ['nfts'] }),
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
            testChainContext({ services: ['nfts'] }),
            ETHEREUM,
        )

        const state = await ops.fetchAccountState(FIRST, SCOPE, HINT)

        expect(state.holdings.map(h => h.assetId)).toEqual(['native'])
        expect(state.unrefreshedHoldings?.error).toEqual(new Error('disk full'))
    })
})
