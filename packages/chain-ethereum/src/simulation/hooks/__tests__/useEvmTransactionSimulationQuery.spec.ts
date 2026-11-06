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

// @vitest-environment jsdom
import React from 'react'
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PERA_URL } from '../../../__tests__/pera-backend'
import {
    peraEvmSimulationHandlers,
    simulationRevertedResponse,
} from '../../api/msw-handlers'
import type { EvmSimulationRequest } from '../../types'
import { useEvmTransactionSimulationQuery } from '../useEvmTransactionSimulationQuery'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['simulations'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const REQUEST: EvmSimulationRequest = {
    from: '0x5A1E000000000000000000000000000000000001',
    to: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    value: new Decimal(0),
    data: '0x7ff36ab5',
    gas: 250_000n,
    maxFeePerGas: new Decimal(30),
    maxPriorityFeePerGas: new Decimal(2),
}

const server = setupServer()
let requests = 0

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', () => {
        requests += 1
    })
})
afterEach(() => {
    server.resetHandlers()
    requests = 0
    onlineManager.setOnline(true)
})
afterAll(() => server.close())

const wrapperWith = (client: QueryClient) =>
    function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(QueryClientProvider, { client }, children)
    }

const newClient = () => new QueryClient()

describe('useEvmTransactionSimulationQuery', () => {
    it('returns the prediction', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationRevertedResponse('STF'),
            }),
        )

        const { result } = renderHook(
            () =>
                useEvmTransactionSimulationQuery({
                    scope: SCOPE,
                    request: REQUEST,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await waitFor(() => {
            expect(result.current.data).toEqual({
                status: 'reverted',
                revertReason: 'STF',
            })
        })
        expect(result.current.isPending).toBe(false)
    })

    it('asks nothing while disabled, and is not pending', async () => {
        server.use(...peraEvmSimulationHandlers({ baseUrl: PERA_URL }))

        const { result } = renderHook(
            () =>
                useEvmTransactionSimulationQuery({
                    scope: SCOPE,
                    request: REQUEST,
                    isEnabled: false,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(result.current).toEqual({
            data: undefined,
            isPending: false,
            isError: false,
        })
        expect(requests).toBe(0)
    })

    it('reports an error, without retrying, when the backend fails', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: 500,
            }),
        )

        const { result } = renderHook(
            () =>
                useEvmTransactionSimulationQuery({
                    scope: SCOPE,
                    request: REQUEST,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(requests).toBe(1)
    })

    it('asks once for an identical call across re-renders and a fresh mount', async () => {
        server.use(
            ...peraEvmSimulationHandlers({
                baseUrl: PERA_URL,
                simulation: simulationRevertedResponse(null),
            }),
        )
        const client = newClient()
        const params = { scope: SCOPE, request: REQUEST, isEnabled: true }

        const first = renderHook(
            () => useEvmTransactionSimulationQuery(params),
            { wrapper: wrapperWith(client) },
        )
        await waitFor(() => expect(first.result.current.data).toBeDefined())
        first.rerender()
        first.unmount()
        const second = renderHook(
            () =>
                useEvmTransactionSimulationQuery({
                    ...params,
                    request: { ...REQUEST },
                }),
            { wrapper: wrapperWith(client) },
        )

        expect(second.result.current.data).toBeDefined()
        expect(requests).toBe(1)
    })
})
