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
import { setupServer } from 'msw/node'
import { getAddress, type Hex } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { createEthereumAccountStateOps } from '../account-state'
import { peraEvmHandlers } from '../msw-handlers'
import { nativeWhitelistItem } from '../../assets/api/msw-handlers'
import type { WhitelistItemResponse } from '../../assets/api/schema'
import {
    erc20CallResponder,
    EvmRpcErrorFixture,
    evmRpcHandlers,
    type Erc20Fixture,
    type EvmRpcFixtures,
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
const HINT = { priorResourceCount: 0 }

const address = (seed: number): Hex =>
    `0x${seed.toString(16).padStart(40, '0')}`

const ACCOUNTS = Array.from({ length: 10 }, (_, i) => address(0xa00 + i))
const TOKENS = Array.from({ length: 20 }, (_, i) =>
    getAddress(address(0xc00 + i)),
)

const listed = (token: string): WhitelistItemResponse => ({
    ...nativeWhitelistItem(1),
    asset_id: `eip155:1/erc20:${token.toLowerCase()}`,
    type: 'erc20',
    unit_name: 'TKN',
    fraction_decimals: 6,
})

// Every account holds one unit more of each token than the account before it.
const tokenFixtures = Object.fromEntries(
    TOKENS.map((token, t): [string, Erc20Fixture] => [
        token,
        {
            name: 'Token',
            symbol: 'TKN',
            decimals: 6,
            totalSupply: 10n ** 12n,
            balances: Object.fromEntries(
                ACCOUNTS.map((account, a) => [
                    getAddress(account),
                    BigInt(a * 100 + t + 1),
                ]),
            ),
        },
    ]),
)

const fixtures = (responses: EvmRpcFixtures['responses'] = {}) => [
    ...evmRpcHandlers({
        rpcUrl: TEST_RPC_URL,
        responses: {
            eth_blockNumber: '0x64',
            eth_call: erc20CallResponder(tokenFixtures),
            eth_getBalance: ([holder]) =>
                `0x${(ACCOUNTS.indexOf(holder as Hex) + 1).toString(16)}`,
            eth_getTransactionCount: '0x2',
            ...responses,
        },
    }),
    ...peraEvmHandlers({
        baseUrl: TEST_PERA_URL,
        whitelist: { 1: [nativeWhitelistItem(1), ...TOKENS.map(listed)] },
    }),
]

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
    server.resetHandlers()
    server.events.removeAllListeners()
})
afterAll(() => server.close())

const countRpcRequests = (): { count: number } => {
    const counter = { count: 0 }
    server.events.on('request:start', ({ request }) => {
        if (request.url === TEST_RPC_URL) counter.count += 1
    })
    return counter
}

const readAll = (accounts: readonly Hex[] = ACCOUNTS) => {
    const ops = createEthereumAccountStateOps(
        testChainContext({ services: ['assets'] }),
    )
    return Promise.allSettled(
        accounts.map(account => ops.fetchAccountState(account, SCOPE, HINT)),
    )
}

describe('fetchAccountState batching', () => {
    it('reads 10 accounts holding 20 listed tokens in at most 4 RPC requests', async () => {
        server.use(...fixtures())
        const requests = countRpcRequests()

        const reads = await readAll()

        expect(requests.count).toBeLessThanOrEqual(4)
        const states = reads.map(read => {
            if (read.status === 'rejected') throw read.reason
            return read.value
        })
        states.forEach((state, a) => {
            expect(state.nativeBalanceBaseUnits.toFixed()).toBe(String(a + 1))
            expect(state.holdings).toHaveLength(1 + TOKENS.length)
            expect(state.holdings[1]!.amount.toFixed()).toBe(
                String(a * 100 + 1),
            )
            expect(state.observedRound).toBe(100)
        })
    })

    it('reads that arrive within the window share one block number', async () => {
        server.use(...fixtures())
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
            { readWindowMs: 20 },
        )
        const blockReads: number[] = []
        server.events.on('request:start', async ({ request }) => {
            if (request.url !== TEST_RPC_URL) return
            const body: unknown = await request.clone().json()
            const calls = (Array.isArray(body) ? body : [body]) as {
                method: string
            }[]
            blockReads.push(
                calls.filter(call => call.method === 'eth_blockNumber').length,
            )
        })

        const first = ops.fetchAccountState(ACCOUNTS[0]!, SCOPE, HINT)
        await new Promise(resolve => setTimeout(resolve, 5))
        const second = ops.fetchAccountState(ACCOUNTS[1]!, SCOPE, HINT)
        await Promise.all([first, second])

        expect(blockReads.reduce((sum, n) => sum + n, 0)).toBe(1)
    })

    it('rejects every read in the batch when the balance call fails', async () => {
        server.use(
            ...fixtures({
                eth_call: new EvmRpcErrorFixture(-32_000, 'header not found'),
            }),
        )

        const reads = await readAll(ACCOUNTS.slice(0, 3))

        expect(reads.map(read => read.status)).toEqual([
            'rejected',
            'rejected',
            'rejected',
        ])
    })

    it('rejects only the account whose nonce read fails', async () => {
        const broken = ACCOUNTS[1]!
        server.use(
            ...fixtures({
                eth_getTransactionCount: ([holder]) =>
                    holder === broken
                        ? new EvmRpcErrorFixture(-32_000, 'nonce unavailable')
                        : '0x2',
            }),
        )

        const reads = await readAll(ACCOUNTS.slice(0, 3))

        expect(reads.map(read => read.status)).toEqual([
            'fulfilled',
            'rejected',
            'fulfilled',
        ])
    })

    it('rejects a malformed address alone, without failing the batch', async () => {
        server.use(...fixtures())
        const ops = createEthereumAccountStateOps(
            testChainContext({ services: ['assets'] }),
        )

        const reads = await Promise.allSettled([
            ops.fetchAccountState(ACCOUNTS[0]!, SCOPE, HINT),
            ops.fetchAccountState('0xnot-an-address', SCOPE, HINT),
        ])

        expect(reads.map(read => read.status)).toEqual([
            'fulfilled',
            'rejected',
        ])
    })
})
