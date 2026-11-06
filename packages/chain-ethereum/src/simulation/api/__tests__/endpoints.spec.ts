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

import { Decimal } from 'decimal.js'
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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { PERA_URL } from '../../../__tests__/pera-backend'
import type { EvmSimulationRequest } from '../../types'
import {
    fetchEvmTransactionSimulation,
    SIMULATION_REQUEST_BOUNDS,
    simulationPath,
} from '../endpoints'
import {
    peraEvmSimulationHandlers,
    simulationRevertedResponse,
    simulationSuccessResponse,
    simulationUnavailableResponse,
} from '../msw-handlers'

const offered = vi.hoisted(() => ({ simulations: true }))

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const withBackend = await (
        await import('../../../__tests__/pera-backend')
    ).withEthereumPeraBackend(importOriginal, ['simulations'])
    return {
        ...withBackend,
        hasPeraService: (
            scope: ChainScope,
            service: Parameters<typeof withBackend.hasPeraService>[1],
        ) =>
            service === 'simulations'
                ? offered.simulations
                : withBackend.hasPeraService(scope, service),
    }
})

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const SENDER = '0x5A1E000000000000000000000000000000000001'
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

const REQUEST: EvmSimulationRequest = {
    from: SENDER,
    to: ROUTER,
    value: new Decimal('100000000000000000'),
    data: '0x7ff36ab5',
    gas: 250_000n,
    maxFeePerGas: new Decimal('20000000000'),
    maxPriorityFeePerGas: new Decimal('1000000000'),
}

const server = setupServer()
const requested: Promise<{ path: string; body: unknown }>[] = []

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', ({ request }) => {
        const clone = request.clone()
        requested.push(
            clone.json().then(body => ({
                path: new URL(request.url).pathname,
                body,
            })),
        )
    })
})
afterEach(() => {
    server.resetHandlers()
    requested.length = 0
    offered.simulations = true
    vi.useRealTimers()
})
afterAll(() => server.close())

describe('fetchEvmTransactionSimulation', () => {
    it("returns a swap's deltas", async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationSuccessResponse([
                    {
                        asset_id: 'eip155:1/slip44:60',
                        standard: 'native',
                        token_id: null,
                        amount: '-100000000000000000',
                    },
                    {
                        asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
                        standard: 'erc20',
                        token_id: null,
                        amount: '241050501',
                    },
                ]),
            }),
        )

        const result = await fetchEvmTransactionSimulation(
            MAINNET,
            ETHEREUM,
            REQUEST,
        )

        expect(result.status === 'success' && result.assetChanges).toEqual([
            {
                assetId: ETHEREUM.nativeAsset.assetId,
                standard: 'native',
                amount: new Decimal('-100000000000000000'),
            },
            {
                assetId: USDC,
                standard: 'erc20',
                amount: new Decimal('241050501'),
            },
        ])
    })

    it('returns a revert with its reason', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationRevertedResponse('STF'),
            }),
        )

        await expect(
            fetchEvmTransactionSimulation(MAINNET, ETHEREUM, REQUEST),
        ).resolves.toEqual({ status: 'reverted', revertReason: 'STF' })
    })

    it('returns unavailable when the backend cannot predict', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationUnavailableResponse('timeout'),
            }),
        )

        await expect(
            fetchEvmTransactionSimulation(MAINNET, ETHEREUM, REQUEST),
        ).resolves.toEqual({ status: 'unavailable' })
    })

    it('rejects on an HTTP failure, never answering with an empty success', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: 500,
            }),
        )

        await expect(
            fetchEvmTransactionSimulation(MAINNET, ETHEREUM, REQUEST),
        ).rejects.toThrow()
    })

    it('rejects a body it cannot read', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: { status: 'success' } as never,
            }),
        )

        await expect(
            fetchEvmTransactionSimulation(MAINNET, ETHEREUM, REQUEST),
        ).rejects.toThrow()
    })

    it('rejects when the backend does not answer within its bound', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: 'hang',
            }),
        )

        const outcome = fetchEvmTransactionSimulation(
            MAINNET,
            ETHEREUM,
            REQUEST,
        ).then(
            () => 'resolved',
            () => 'rejected',
        )
        await vi.advanceTimersByTimeAsync(
            SIMULATION_REQUEST_BOUNDS.timeout + 100,
        )

        await expect(outcome).resolves.toBe('rejected')
    })

    it('sends the call snake_cased, lowercase and in decimal, to the scope own chain id', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationSuccessResponse([]),
            }),
        )

        await fetchEvmTransactionSimulation(SEPOLIA, ETHEREUM, REQUEST)

        expect(await Promise.all(requested)).toEqual([
            {
                path: simulationPath(11_155_111),
                body: {
                    from: SENDER.toLowerCase(),
                    to: ROUTER.toLowerCase(),
                    value: '100000000000000000',
                    data: '0x7ff36ab5',
                    gas: '250000',
                    max_fee_per_gas: '20000000000',
                    max_priority_fee_per_gas: '1000000000',
                },
            },
        ])
    })

    it('answers unavailable without a request on a scope that offers no simulation', async () => {
        offered.simulations = false
        server.use(...peraEvmSimulationHandlers({ baseUrl: PERA_URL }))

        await expect(
            fetchEvmTransactionSimulation(MAINNET, ETHEREUM, REQUEST),
        ).resolves.toEqual({ status: 'unavailable' })
        expect(requested).toEqual([])
    })
})
