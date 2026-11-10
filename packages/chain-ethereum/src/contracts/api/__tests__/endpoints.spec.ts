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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { PERA_URL } from '../../../__tests__/pera-backend'
import {
    contractPath,
    fetchEvmContractAbi,
    fetchEvmContractMetadata,
} from '../endpoints'
import {
    contractMetadataResponse,
    peraEvmContractHandlers,
    verifiedAbiResponse,
} from '../msw-handlers'

const offered = vi.hoisted(() => ({ contracts: true }))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('../../../__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['contracts'])
    return {
        ...withBackend,
        hasPeraService: (scope: ChainScope, service: string) =>
            service === 'contracts'
                ? offered.contracts
                : withBackend.hasPeraService(scope, service as never),
    }
})

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const IMPLEMENTATION = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
const ABI = [
    {
        type: 'function',
        name: 'deposit',
        stateMutability: 'payable',
        inputs: [],
        outputs: [],
    },
]

const server = setupServer()
const requested: string[] = []

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', ({ request }) => {
        const url = new URL(request.url)
        requested.push(`${url.pathname}${url.search}`)
    })
})
afterEach(() => {
    server.resetHandlers()
    requested.length = 0
    offered.contracts = true
})
afterAll(() => server.close())

describe('fetchEvmContractAbi', () => {
    it('returns the verified ABI of a contract', async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: {
                    [ROUTER.toLowerCase()]: verifiedAbiResponse(ABI),
                },
            }),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toEqual({ status: 'verified', abi: ABI })
        expect(requested).toEqual([
            `${contractPath(1, ROUTER.toLowerCase())}?include=abi`,
        ])
    })

    it("returns a proxy's implementation ABI marked with the implementation", async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: {
                    [ROUTER.toLowerCase()]: verifiedAbiResponse(
                        ABI,
                        IMPLEMENTATION,
                    ),
                },
            }),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toEqual({
            status: 'verified',
            abi: ABI,
            proxy: { implementation: IMPLEMENTATION },
        })
    })

    it('returns unverified for a contract the backend has no source for', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toEqual({ status: 'unverified' })
    })

    it.each(['not_verified', 'unresolved_proxy'])(
        'returns unverified when the backend answers %s, proxy or not',
        async status => {
            server.use(
                http.get(
                    `${PERA_URL}${contractPath(':chainId', ':address')}`,
                    () =>
                        HttpResponse.json({
                            abi: {
                                status,
                                abi: null,
                                registry: null,
                                proxy: {
                                    standard: 'eip1967',
                                    implementation:
                                        IMPLEMENTATION.toLowerCase(),
                                },
                            },
                        }),
                ),
            )

            await expect(
                fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
            ).resolves.toEqual({ status: 'unverified' })
        },
    )

    it('rejects a verified answer without an ABI', async () => {
        server.use(
            http.get(`${PERA_URL}${contractPath(':chainId', ':address')}`, () =>
                HttpResponse.json({
                    abi: {
                        status: 'verified',
                        abi: null,
                        registry: 'sourcify',
                        proxy: null,
                    },
                }),
            ),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })

    it('rejects when the backend fails, never answering unverified', async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: 500,
            }),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })

    it('rejects a body it cannot read', async () => {
        server.use(
            http.get(`${PERA_URL}${contractPath(':chainId', ':address')}`, () =>
                HttpResponse.json({
                    abi: { status: 'verified', abi: 'nope' },
                }),
            ),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })

    it('rejects a proxy answer without a readable implementation', async () => {
        server.use(
            http.get(`${PERA_URL}${contractPath(':chainId', ':address')}`, () =>
                HttpResponse.json({
                    abi: {
                        status: 'verified',
                        abi: ABI,
                        registry: 'sourcify',
                        proxy: {
                            standard: 'eip1967',
                            implementation: null,
                        },
                    },
                }),
            ),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })

    it("rejects when the backend couldn't ask the registries, so it is never read as unverified", async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: {
                    [ROUTER.toLowerCase()]: {
                        status: 'unavailable',
                        abi: null,
                        registry: null,
                        proxy: null,
                    },
                },
            }),
        )

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })

    it("asks for the scope's own chain id, so testnet never reads mainnet's answer", async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        await fetchEvmContractAbi(SEPOLIA, ETHEREUM, ROUTER)

        expect(requested).toEqual([
            `${contractPath(11_155_111, ROUTER.toLowerCase())}?include=abi`,
        ])
    })

    it('answers unavailable without a request on a scope that offers no lookup', async () => {
        offered.contracts = false
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        await expect(
            fetchEvmContractAbi(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toEqual({ status: 'unavailable' })
        expect(requested).toEqual([])
    })
})

describe('fetchEvmContractMetadata', () => {
    it("returns a verified project's contract metadata, asking for the metadata alone", async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractMetadata: {
                    [ROUTER.toLowerCase()]: contractMetadataResponse(
                        'Aave V3 Pool',
                        'Aave',
                        'https://aave.com',
                    ),
                },
            }),
        )

        await expect(
            fetchEvmContractMetadata(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toEqual({
            name: 'Aave V3 Pool',
            projectUrl: 'https://aave.com',
        })
        expect(requested).toEqual([
            `${contractPath(1, ROUTER.toLowerCase())}?include=metadata`,
        ])
    })

    it('returns null for a contract Pera does not know', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        await expect(
            fetchEvmContractMetadata(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toBeNull()
    })

    it.each(['unverified', 'suspicious'])(
        'returns null for a contract whose project is %s',
        async tier => {
            server.use(
                ...peraEvmContractHandlers({
                    baseUrl: PERA_URL,
                    contractMetadata: {
                        [ROUTER.toLowerCase()]: contractMetadataResponse(
                            'Pool',
                            'Lookalike',
                            'https://example.com',
                            tier,
                        ),
                    },
                }),
            )

            await expect(
                fetchEvmContractMetadata(MAINNET, ETHEREUM, ROUTER),
            ).resolves.toBeNull()
        },
    )

    it('returns null without a request on a scope that offers no lookup', async () => {
        offered.contracts = false
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        await expect(
            fetchEvmContractMetadata(MAINNET, ETHEREUM, ROUTER),
        ).resolves.toBeNull()
        expect(requested).toEqual([])
    })

    it('rejects when the backend fails', async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: 500,
            }),
        )

        await expect(
            fetchEvmContractMetadata(MAINNET, ETHEREUM, ROUTER),
        ).rejects.toThrow()
    })
})
