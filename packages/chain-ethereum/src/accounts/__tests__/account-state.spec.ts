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
import type { Hex } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { createEthereumAccountStateOps } from '../account-state'
import { peraEvmHandlers, type ShouldRefreshRequest } from '../msw-handlers'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { PERA_URL } from '../../__tests__/pera-backend'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const RPC_URL = 'https://mainnet.rpc.test/'
const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ADDRESS: Hex = '0x00000000000000000000000000000000000000aa'

const contextWith = (services: readonly string[] = []): ChainContext => ({
    getScope: () => SCOPE,
    getEndpoints: () => ({ mainnet: RPC_URL }),
    getPeraBackend: () => ({ baseUrl: PERA_URL, services: new Set(services) }),
    timeouts: { readMs: 1_000, submitMs: 1_000 },
    kms: {} as ChainContext['kms'],
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('createEthereumAccountStateOps', () => {
    describe('fetchAccountState', () => {
        it('reads balance and latest nonce at one block, and the pending nonce', async () => {
            const balanceTags: unknown[] = []
            const nonceTags: unknown[] = []
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: {
                        eth_blockNumber: '0x10',
                        eth_getBalance: ([, tag]) => {
                            balanceTags.push(tag)
                            return '0xde0b6b3a7640000'
                        },
                        eth_getTransactionCount: ([, tag]) => {
                            nonceTags.push(tag)
                            return tag === 'pending' ? '0x9' : '0x7'
                        },
                    },
                }),
            )

            const state = await createEthereumAccountStateOps(
                contextWith(),
            ).fetchAccountState(ADDRESS, SCOPE, { priorChainState: undefined })

            expect(balanceTags).toEqual(['0x10'])
            expect(nonceTags.sort()).toEqual(['0x10', 'pending'])
            expect(state.chainState).toEqual({
                family: 'evm',
                nonce: { latest: 7, pending: 9 },
            })
            expect(state.nativeBalanceBaseUnits.toFixed()).toBe(
                '1000000000000000000',
            )
            expect(state.holdings).toEqual([
                {
                    assetId: 'native',
                    amount: state.nativeBalanceBaseUnits,
                    isFrozen: false,
                },
            ])
            expect(state.observedRound).toBe(16)
        })

        it('keeps wei precision past 2^53', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    // 123456789.123456789123456789 ETH.
                    responses: { eth_getBalance: '0x661efdf2e3b19f7c045f15' },
                }),
            )

            const state = await createEthereumAccountStateOps(
                contextWith(),
            ).fetchAccountState(ADDRESS, SCOPE, { priorChainState: undefined })

            expect(state.nativeBalanceBaseUnits.toFixed()).toBe(
                '123456789123456789123456789',
            )
        })
    })

    describe('accountExists', () => {
        it('counts a spent-out account with a nonce as existing', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: {
                        eth_getBalance: '0x0',
                        eth_getTransactionCount: '0x1',
                    },
                }),
            )

            await expect(
                createEthereumAccountStateOps(contextWith()).accountExists(
                    ADDRESS,
                    SCOPE,
                ),
            ).resolves.toBe(true)
        })
    })

    describe('fetchChangeSignal over JSON-RPC', () => {
        it('never moves the cursor back when the node lags behind it', async () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: RPC_URL,
                    responses: { eth_blockNumber: '0x5' },
                }),
            )

            await expect(
                createEthereumAccountStateOps(contextWith()).fetchChangeSignal(
                    [ADDRESS],
                    SCOPE,
                    10,
                ),
            ).resolves.toEqual({ changed: false, cursor: 10 })
        })
    })

    describe('fetchChangeSignal over Pera block following', () => {
        it('sends the addresses and the cursor to the scope backend', async () => {
            const requests: ShouldRefreshRequest[] = []
            server.use(
                ...peraEvmHandlers({
                    baseUrl: PERA_URL,
                    blockFollowing: request => {
                        requests.push(request)
                        return { refresh: true, block: 42 }
                    },
                }),
            )

            await createEthereumAccountStateOps(
                contextWith(['blockFollowing']),
            ).fetchChangeSignal([ADDRESS], SCOPE, 40)

            expect(requests).toEqual([
                { account_addresses: [ADDRESS], last_refreshed_block: 40 },
            ])
        })

        it('rejects with the status when the backend fails', async () => {
            server.use(
                ...peraEvmHandlers({ baseUrl: PERA_URL, blockFollowing: 503 }),
            )

            await expect(
                createEthereumAccountStateOps(
                    contextWith(['blockFollowing']),
                ).fetchChangeSignal([ADDRESS], SCOPE, 40),
            ).rejects.toSatisfy(
                error =>
                    error instanceof PeraNetworkError && error.status === 503,
            )
        })

        it('rejects a response that does not match the schema', async () => {
            server.use(
                ...peraEvmHandlers({
                    baseUrl: PERA_URL,
                    blockFollowing: () =>
                        ({ refresh: 'yes' }) as unknown as {
                            refresh: boolean
                            block: number
                        },
                }),
            )

            await expect(
                createEthereumAccountStateOps(
                    contextWith(['blockFollowing']),
                ).fetchChangeSignal([ADDRESS], SCOPE, 40),
            ).rejects.toThrow()
        })
    })
})
