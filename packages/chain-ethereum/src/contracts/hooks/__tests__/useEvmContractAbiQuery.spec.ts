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
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { PERA_URL } from '../../../__tests__/pera-backend'
import {
    peraEvmContractHandlers,
    verifiedAbiResponse,
} from '../../api/msw-handlers'
import { contractQueryKey } from '../querykeys'
import { useEvmContractAbiQuery } from '../useEvmContractAbiQuery'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['contracts'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
const ABI = [{ type: 'function', name: 'deposit', inputs: [], outputs: [] }]

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

const newClient = () =>
    new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } })

describe('useEvmContractAbiQuery', () => {
    it("returns the contract's verified ABI", async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: {
                    [ROUTER.toLowerCase()]: verifiedAbiResponse(ABI),
                },
            }),
        )

        const { result } = renderHook(
            () =>
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await waitFor(() => {
            expect(result.current.data).toEqual({
                status: 'verified',
                abi: ABI,
            })
        })
        expect(result.current.isPending).toBe(false)
        expect(result.current.isError).toBe(false)
    })

    it('asks nothing while disabled, and is not pending', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        const { result } = renderHook(
            () =>
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER,
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

    it('asks nothing without a target address', async () => {
        const { result } = renderHook(
            () =>
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: undefined,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(result.current.isPending).toBe(false)
        expect(requests).toBe(0)
    })

    it('reports an error when the backend fails', async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: 503,
            }),
        )

        const { result } = renderHook(
            () =>
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })
        expect(result.current.isPending).toBe(false)
        expect(requests).toBe(1)
    })

    it('asks even while the device reads as offline, so a review never waits on a paused lookup', async () => {
        onlineManager.setOnline(false)
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        const { result } = renderHook(
            () =>
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER,
                    isEnabled: true,
                }),
            { wrapper: wrapperWith(newClient()) },
        )

        await waitFor(() => {
            expect(result.current.data).toEqual({ status: 'unverified' })
        })
        expect(requests).toBe(1)
    })

    it('shares one request between calls to the same contract', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))
        const wrapper = wrapperWith(newClient())

        const { result } = renderHook(
            () => [
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER,
                    isEnabled: true,
                }),
                useEvmContractAbiQuery({
                    scope: SCOPE,
                    address: ROUTER.toLowerCase() as typeof ROUTER,
                    isEnabled: true,
                }),
            ],
            { wrapper },
        )

        await waitFor(() => {
            expect(result.current[1].data).toEqual({ status: 'unverified' })
        })
        expect(requests).toBe(1)
    })
})

describe('contractQueryKey', () => {
    it('keys by part, chain, network and lowercase address', () => {
        expect(contractQueryKey('abi', SCOPE, ROUTER)).toEqual([
            'evm-contracts',
            'abi',
            'ethereum',
            'mainnet',
            ROUTER.toLowerCase(),
        ])
    })
})
