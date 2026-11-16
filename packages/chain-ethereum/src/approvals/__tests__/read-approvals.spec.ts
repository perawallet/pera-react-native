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
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import { getAddress, maxUint160, maxUint256 } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { PERA_URL } from '../../__tests__/pera-backend'
import {
    evmApprovalCallResponder,
    evmRpcHandlers,
    type EvmApprovalFixture,
} from '../../blockchain/msw-handlers'
import {
    contractMetadataResponse,
    peraEvmContractHandlers,
} from '../../contracts/api/msw-handlers'
import {
    evmAllowanceCandidate,
    evmOperatorCandidate,
    peraEvmApprovalHandlers,
} from '../api/msw-handlers'
import type { ApprovalCandidateResponse } from '../api/schema'
import { readEvmApprovals } from '../read-approvals'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['approvals', 'contracts'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const OWNER = getAddress('0x00000000000000000000000000000000000000aa')
const USDC = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
const DAI = getAddress('0x6B175474E89094C44Da98b954EedeAC495271d0F')
const ROUTER = getAddress('0xE592427A0AEce92De3Edee1F18E0157C05861564')
const PERMIT2 = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3')
const APES = getAddress('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d')
const SEAPORT = getAddress('0x1E0049783F008A0085193E00003D00cd54003c71')

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ctx = testChainContext({ services: ['approvals', 'contracts'] })

const allowance = (token: string, spender: string) =>
    evmAllowanceCandidate({ token, spender })

const operator = (collection: string, op: string) =>
    evmOperatorCandidate({ collection, operator: op })

const useBackend = ({
    pages,
    chain = {},
    metadata = {},
}: {
    pages: ApprovalCandidateResponse[][]
    chain?: EvmApprovalFixture
    metadata?: Record<string, ReturnType<typeof contractMetadataResponse>>
}) =>
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: { eth_call: evmApprovalCallResponder(chain) },
        }),
        ...peraEvmApprovalHandlers({
            baseUrl: PERA_URL,
            approvals: { [OWNER.toLowerCase()]: pages },
        }),
        ...peraEvmContractHandlers({
            baseUrl: PERA_URL,
            contractMetadata: metadata,
        }),
    )

const read = () => readEvmApprovals(ctx, ETHEREUM, SCOPE, OWNER)

describe('readEvmApprovals', () => {
    it('lists an unlimited allowance without an amount, and an operator approval for a collection', async () => {
        useBackend({
            pages: [[allowance(USDC, ROUTER), operator(APES, SEAPORT)]],
            chain: {
                allowances: {
                    [USDC]: [
                        { owner: OWNER, spender: ROUTER, amount: maxUint256 },
                    ],
                },
                operators: { [APES]: [{ owner: OWNER, operator: SEAPORT }] },
            },
        })

        await expect(read()).resolves.toEqual([
            {
                kind: 'allowance',
                assetRef: { chainId: 'ethereum', assetId: USDC },
                spender: ROUTER,
            },
            {
                kind: 'collection',
                collection: APES,
                collectionName: 'Bored Ape Yacht Club',
                spender: SEAPORT,
            },
        ])
    })

    it('reads a spent-down allowance as the amount the chain says is left', async () => {
        useBackend({
            pages: [[allowance(USDC, ROUTER)]],
            chain: {
                allowances: {
                    [USDC]: [
                        { owner: OWNER, spender: ROUTER, amount: 2_500_000n },
                    ],
                },
            },
        })

        const [approval] = await read()

        expect(approval).toMatchObject({ kind: 'allowance' })
        expect(
            approval?.kind === 'allowance' && approval.amount?.toFixed(),
        ).toBe('2500000')
    })

    it('reads an allowance as unlimited from 2^160, the threshold review uses', async () => {
        useBackend({
            pages: [[allowance(USDC, ROUTER), allowance(DAI, ROUTER)]],
            chain: {
                allowances: {
                    [USDC]: [
                        {
                            owner: OWNER,
                            spender: ROUTER,
                            amount: maxUint160 - 1n,
                        },
                    ],
                    [DAI]: [
                        { owner: OWNER, spender: ROUTER, amount: maxUint160 },
                    ],
                },
            },
        })

        const [limited, unlimited] = await read()

        expect(limited).toMatchObject({
            amount: new Decimal((maxUint160 - 1n).toString()),
        })
        expect(unlimited).not.toHaveProperty('amount')
    })

    it('drops a pair the backend returns that the chain now reads as zero or false', async () => {
        useBackend({
            pages: [
                [
                    allowance(USDC, ROUTER),
                    allowance(DAI, ROUTER),
                    operator(APES, SEAPORT),
                ],
            ],
            chain: {
                allowances: {
                    // Spent down to nothing by a later transferFrom.
                    [USDC]: [{ owner: OWNER, spender: ROUTER, amount: 0n }],
                    [DAI]: [
                        { owner: OWNER, spender: ROUTER, amount: maxUint256 },
                    ],
                },
                // The collection answers, but not for this operator.
                operators: { [APES]: [] },
            },
        })

        const approvals = await read()

        expect(approvals).toHaveLength(1)
        expect(approvals[0]).toMatchObject({
            kind: 'allowance',
            assetRef: { assetId: DAI },
        })
    })

    it('drops a pair whose contract reverts', async () => {
        useBackend({
            pages: [[allowance(USDC, ROUTER)]],
            chain: {},
        })

        await expect(read()).resolves.toEqual([])
    })

    it('drops a pair whose address has no code, which a node answers with empty data', async () => {
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: { eth_call: () => '0x' },
            }),
            ...peraEvmApprovalHandlers({
                baseUrl: PERA_URL,
                approvals: {
                    [OWNER.toLowerCase()]: [
                        [allowance(USDC, ROUTER), operator(APES, SEAPORT)],
                    ],
                },
            }),
        )

        await expect(read()).resolves.toEqual([])
    })

    it("names a spender with Pera's verified metadata, ahead of the bundled registry", async () => {
        useBackend({
            pages: [[allowance(USDC, PERMIT2), allowance(DAI, ROUTER)]],
            chain: {
                allowances: {
                    [USDC]: [
                        { owner: OWNER, spender: PERMIT2, amount: maxUint256 },
                    ],
                    [DAI]: [
                        { owner: OWNER, spender: ROUTER, amount: maxUint256 },
                    ],
                },
            },
            metadata: {
                [PERMIT2.toLowerCase()]: contractMetadataResponse(
                    'Uniswap Permit2',
                    'Uniswap',
                    'https://uniswap.org',
                ),
                [ROUTER.toLowerCase()]: contractMetadataResponse(
                    'Uniswap V3 Router',
                    'Uniswap',
                    'https://uniswap.org',
                    'unverified',
                ),
            },
        })

        const [permit2, router] = await read()

        expect(permit2?.knownSpender).toEqual({ name: 'Uniswap Permit2' })
        // An unverified project is no label, and the router isn't bundled.
        expect(router).not.toHaveProperty('knownSpender')
    })

    it('falls back to the bundled registry when the backend knows nothing of the spender', async () => {
        useBackend({
            pages: [[allowance(USDC, PERMIT2)]],
            chain: {
                allowances: {
                    [USDC]: [
                        { owner: OWNER, spender: PERMIT2, amount: maxUint256 },
                    ],
                },
            },
        })

        const [approval] = await read()

        expect(approval?.knownSpender).toMatchObject({ name: 'Permit2' })
    })

    it('reads candidates from every page', async () => {
        useBackend({
            pages: [[allowance(USDC, ROUTER)], [operator(APES, SEAPORT)]],
            chain: {
                allowances: {
                    [USDC]: [
                        { owner: OWNER, spender: ROUTER, amount: maxUint256 },
                    ],
                },
                operators: { [APES]: [{ owner: OWNER, operator: SEAPORT }] },
            },
        })

        await expect(read()).resolves.toHaveLength(2)
    })

    it('makes no node call when the backend lists no candidates', async () => {
        const calls = vi.fn()
        server.use(
            ...peraEvmApprovalHandlers({ baseUrl: PERA_URL }),
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_call: params => {
                        calls(params)
                        return '0x'
                    },
                },
            }),
        )

        await expect(read()).resolves.toEqual([])
        expect(calls).not.toHaveBeenCalled()
    })

    it('rejects when the backend cannot be read, rather than listing nothing', async () => {
        server.use(
            ...peraEvmApprovalHandlers({ baseUrl: PERA_URL, approvals: 500 }),
        )

        await expect(read()).rejects.toThrow()
    })
})
