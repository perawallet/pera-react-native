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
    contractMetadataResponse,
    peraEvmContractHandlers,
} from '../../api/msw-handlers'
import { useEvmContractMetadataQuery } from '../useEvmContractMetadataQuery'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['contracts'],
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'

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

const render = (address: string | undefined, isEnabled = true) =>
    renderHook(
        () => useEvmContractMetadataQuery({ scope: SCOPE, address, isEnabled }),
        { wrapper: wrapperWith(newClient()) },
    )

describe('useEvmContractMetadataQuery', () => {
    it("returns a verified project's contract metadata", async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractMetadata: {
                    [ROUTER.toLowerCase()]: contractMetadataResponse(
                        'Universal Router',
                        'Uniswap',
                        'https://uniswap.org',
                    ),
                },
            }),
        )

        const { result } = render(ROUTER)

        await waitFor(() => {
            expect(result.current.data).toEqual({
                name: 'Universal Router',
                projectUrl: 'https://uniswap.org',
            })
        })
        expect(result.current.isPending).toBe(false)
    })

    it('asks nothing while disabled, and is not pending', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        const { result } = render(ROUTER, false)

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(result.current).toEqual({ data: null, isPending: false })
        expect(requests).toBe(0)
    })

    it('never looks up a requester-supplied value that is not an address', async () => {
        server.use(...peraEvmContractHandlers({ baseUrl: PERA_URL }))

        const { result } = render('../../admin')

        await new Promise(resolve => setTimeout(resolve, 20))
        expect(result.current).toEqual({ data: null, isPending: false })
        expect(requests).toBe(0)
    })

    it('settles on no metadata when the lookup fails', async () => {
        server.use(
            ...peraEvmContractHandlers({
                baseUrl: PERA_URL,
                contractAbis: 500,
            }),
        )

        const { result } = render(ROUTER)

        await waitFor(() => {
            expect(result.current.isPending).toBe(false)
        })
        expect(result.current.data).toBeNull()
    })
})
