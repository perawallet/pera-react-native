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
import { encodeErrorResult, parseAbi, type Address } from 'viem'
import { toCoinType } from 'viem/ens'
import type { ChainEndpoints } from '@perawallet/wallet-core-chain-contract'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
} from '../../blockchain/msw-handlers'
import { BASE, ETHEREUM, POLYGON, evmScopeOf } from '../../__tests__/evm-chains'
import type { EvmChain } from '../../chains/types'
import {
    ensResolverCallResponder,
    type EnsRecordFixture,
} from '../msw-handlers'
import { verifyEnsAddress } from '../verifyEnsAddress'

const L1_MAINNET = 'https://l1.mainnet.rpc.test/'
const L1_SEPOLIA = 'https://l1.sepolia.rpc.test/'

const endpoints = vi.hoisted(() => ({
    current: {} as Record<string, readonly string[]>,
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-config')
    >()),
    chainEndpointsFor: (chainId: string): ChainEndpoints =>
        chainId === 'ethereum' ? endpoints.current : {},
}))

const ETHEREUM_ADDRESS: Address = '0x1111111111111111111111111111111111111111'
const BASE_ADDRESS: Address = '0x2222222222222222222222222222222222222222'
const DEFAULT_ADDRESS: Address = '0x3333333333333333333333333333333333333333'

const COIN_TYPE_ETHEREUM = 60n
const COIN_TYPE_BASE = toCoinType(8453)
const COIN_TYPE_BASE_SEPOLIA = toCoinType(84532)
const COIN_TYPE_DEFAULT = 0x80000000n

const record = (
    coinType: bigint,
    address: Address,
    name = 'alice.eth',
): EnsRecordFixture => ({ name, coinType, address })

const nameErrors = parseAbi([
    'error ResolverNotFound(bytes name)',
    'error HttpError(uint16 status, string message)',
])

const server = setupServer()
let requested: string[] = []

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    requested = []
    endpoints.current = { mainnet: [L1_MAINNET], sepolia: [L1_SEPOLIA] }
    server.events.on('request:start', ({ request }) => {
        requested.push(request.url)
    })
})
afterEach(() => {
    server.resetHandlers()
    server.events.removeAllListeners()
})
afterAll(() => server.close())

const nodeHolds = (rpcUrl: string, records: readonly EnsRecordFixture[]) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl,
            responses: { eth_call: ensResolverCallResponder(records) },
        }),
    )

const verify = (
    chain: EvmChain,
    name: string,
    address: Address,
    tier: 'mainnet' | 'testnet' = 'mainnet',
    signal?: AbortSignal,
) =>
    verifyEnsAddress(chain, {
        name,
        address,
        scope: evmScopeOf(chain, tier),
        signal,
    })

describe('verifyEnsAddress', () => {
    it("verifies Ethereum's own record on Ethereum", async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS)])

        await expect(
            verify(ETHEREUM, 'alice.eth', ETHEREUM_ADDRESS),
        ).resolves.toBe('verified')
    })

    it('compares addresses regardless of case', async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS)])

        await expect(
            verify(
                ETHEREUM,
                'alice.eth',
                ETHEREUM_ADDRESS.toUpperCase().replace('0X', '0x') as Address,
            ),
        ).resolves.toBe('verified')
    })

    it("verifies a chain's own record on Base, and refuses the name's Ethereum address there", async () => {
        nodeHolds(L1_MAINNET, [
            record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS),
            record(COIN_TYPE_BASE, BASE_ADDRESS),
        ])

        await expect(verify(BASE, 'alice.eth', BASE_ADDRESS)).resolves.toBe(
            'verified',
        )
        await expect(verify(BASE, 'alice.eth', ETHEREUM_ADDRESS)).resolves.toBe(
            'mismatch',
        )
    })

    it('never uses the Ethereum record where the chain has none', async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS)])

        await expect(verify(BASE, 'alice.eth', ETHEREUM_ADDRESS)).resolves.toBe(
            'mismatch',
        )
    })

    it("prefers a chain's own record to the default one", async () => {
        nodeHolds(L1_MAINNET, [
            record(COIN_TYPE_BASE, BASE_ADDRESS),
            record(COIN_TYPE_DEFAULT, DEFAULT_ADDRESS),
        ])

        await expect(verify(BASE, 'alice.eth', DEFAULT_ADDRESS)).resolves.toBe(
            'mismatch',
        )
    })

    it.each([ETHEREUM, BASE, POLYGON])(
        'falls back to the default record on $row.id',
        async chain => {
            nodeHolds(L1_MAINNET, [record(COIN_TYPE_DEFAULT, DEFAULT_ADDRESS)])

            await expect(
                verify(chain, 'alice.eth', DEFAULT_ADDRESS),
            ).resolves.toBe('verified')
        },
    )

    it('does not read the default record once the chain has its own, so a failing default cannot block the send', async () => {
        const calls: unknown[] = []
        const own = ensResolverCallResponder([
            record(COIN_TYPE_BASE, BASE_ADDRESS),
        ])
        server.use(
            ...evmRpcHandlers({
                rpcUrl: L1_MAINNET,
                responses: {
                    eth_call: params => {
                        calls.push(params)
                        return calls.length === 1
                            ? own(params)
                            : new EvmRpcErrorFixture(
                                  3,
                                  'execution reverted',
                                  encodeErrorResult({
                                      abi: nameErrors,
                                      errorName: 'HttpError',
                                      args: [500, 'gateway down'],
                                  }),
                              )
                    },
                },
            }),
        )

        await expect(verify(BASE, 'alice.eth', BASE_ADDRESS)).resolves.toBe(
            'verified',
        )
        expect(calls).toHaveLength(1)
    })

    it('refuses a name with no record at all', async () => {
        nodeHolds(L1_MAINNET, [])

        await expect(verify(BASE, 'alice.eth', BASE_ADDRESS)).resolves.toBe(
            'mismatch',
        )
    })

    it('reads ENS on Sepolia for a testnet and never touches mainnet ENS', async () => {
        nodeHolds(L1_SEPOLIA, [record(COIN_TYPE_BASE_SEPOLIA, BASE_ADDRESS)])
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_BASE, ETHEREUM_ADDRESS)])

        await expect(
            verify(BASE, 'alice.eth', BASE_ADDRESS, 'testnet'),
        ).resolves.toBe('verified')
        expect(requested.every(url => url === L1_SEPOLIA)).toBe(true)
    })

    it('reads Ethereum mainnet for a mainnet chain and never touches Sepolia ENS', async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_BASE, BASE_ADDRESS)])
        nodeHolds(L1_SEPOLIA, [record(COIN_TYPE_BASE, ETHEREUM_ADDRESS)])

        await expect(verify(BASE, 'alice.eth', BASE_ADDRESS)).resolves.toBe(
            'verified',
        )
        expect(requested.every(url => url === L1_MAINNET)).toBe(true)
    })

    it('resolves a name that differs only in case like its normalised form', async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS)])

        await expect(
            verify(ETHEREUM, 'Alice.ETH', ETHEREUM_ADDRESS),
        ).resolves.toBe('verified')
    })

    it('refuses a name the normaliser rejects without any node read', async () => {
        nodeHolds(L1_MAINNET, [
            record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS, 'al_ice.eth'),
        ])

        await expect(
            verify(ETHEREUM, 'al_ice.eth', ETHEREUM_ADDRESS),
        ).resolves.toBe('mismatch')
        expect(requested).toEqual([])
    })

    it('reports an unreachable node as unavailable, not as a verdict', async () => {
        server.use(http.post(L1_MAINNET, () => HttpResponse.error()))

        await expect(
            verify(ETHEREUM, 'alice.eth', ETHEREUM_ADDRESS),
        ).resolves.toBe('unavailable')
    })

    it('reads a resolver that does not exist as no record', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: L1_MAINNET,
                responses: {
                    eth_call: () =>
                        new EvmRpcErrorFixture(
                            3,
                            'execution reverted',
                            encodeErrorResult({
                                abi: nameErrors,
                                errorName: 'ResolverNotFound',
                                args: ['0x'],
                            }),
                        ),
                },
            }),
        )

        await expect(
            verify(ETHEREUM, 'alice.eth', ETHEREUM_ADDRESS),
        ).resolves.toBe('mismatch')
    })

    it('reports any other resolver revert, such as a failing gateway, as unavailable', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: L1_MAINNET,
                responses: {
                    eth_call: () =>
                        new EvmRpcErrorFixture(
                            3,
                            'execution reverted',
                            encodeErrorResult({
                                abi: nameErrors,
                                errorName: 'HttpError',
                                args: [500, 'gateway down'],
                            }),
                        ),
                },
            }),
        )

        await expect(
            verify(ETHEREUM, 'alice.eth', ETHEREUM_ADDRESS),
        ).resolves.toBe('unavailable')
    })

    it('reports a build with no Ethereum endpoint as unavailable', async () => {
        endpoints.current = {}

        await expect(verify(BASE, 'alice.eth', BASE_ADDRESS)).resolves.toBe(
            'unavailable',
        )
    })

    it('throws instead of returning a verdict when already aborted', async () => {
        nodeHolds(L1_MAINNET, [record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS)])
        const controller = new AbortController()
        controller.abort()

        await expect(
            verify(
                ETHEREUM,
                'alice.eth',
                ETHEREUM_ADDRESS,
                'mainnet',
                controller.signal,
            ),
        ).rejects.toMatchObject({ name: 'AbortError' })
        expect(requested).toEqual([])
    })

    it('reports a read that never finishes as unavailable once the read ceiling passes', async () => {
        vi.useFakeTimers()
        try {
            server.use(http.post(L1_MAINNET, () => new Promise(() => {})))

            const pending = verify(ETHEREUM, 'alice.eth', ETHEREUM_ADDRESS)
            await vi.advanceTimersByTimeAsync(15_001)

            await expect(pending).resolves.toBe('unavailable')
        } finally {
            vi.useRealTimers()
        }
    })

    it('stops waiting on a read that never finishes as soon as the pick is cancelled', async () => {
        server.use(http.post(L1_MAINNET, () => new Promise(() => {})))
        const controller = new AbortController()

        const pending = verify(
            ETHEREUM,
            'alice.eth',
            ETHEREUM_ADDRESS,
            'mainnet',
            controller.signal,
        )
        setTimeout(() => controller.abort(), 20)

        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('throws instead of reporting unavailable when the read fails after an abort', async () => {
        const controller = new AbortController()
        server.use(
            http.post(L1_MAINNET, () => {
                controller.abort()
                return HttpResponse.error()
            }),
        )

        await expect(
            verify(
                ETHEREUM,
                'alice.eth',
                ETHEREUM_ADDRESS,
                'mainnet',
                controller.signal,
            ),
        ).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('throws instead of returning a verdict when aborted during the read', async () => {
        const controller = new AbortController()
        server.use(
            ...evmRpcHandlers({
                rpcUrl: L1_MAINNET,
                responses: {
                    eth_call: params => {
                        controller.abort()
                        return ensResolverCallResponder([
                            record(COIN_TYPE_ETHEREUM, ETHEREUM_ADDRESS),
                        ])(params)
                    },
                },
            }),
        )

        await expect(
            verify(
                ETHEREUM,
                'alice.eth',
                ETHEREUM_ADDRESS,
                'mainnet',
                controller.signal,
            ),
        ).rejects.toMatchObject({ name: 'AbortError' })
    })
})
