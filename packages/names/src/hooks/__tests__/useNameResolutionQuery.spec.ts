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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useNameResolutionQuery } from '../useNameResolutionQuery'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

const mockFetchNameSearch = vi.hoisted(() => vi.fn())
const capable = vi.hoisted(() => ({ chainIds: new Set<string>() }))

vi.mock('../../api', () => ({
    fetchNameSearch: mockFetchNameSearch,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapabilityCheck:
        () => (requirement: { chain?: { chainId: string } }) =>
            capable.chainIds.has(requirement.chain?.chainId ?? ''),
}))

const result = (name: string, address: string) => ({
    name,
    address,
    service: { name: 'svc', logo: '' },
})

describe('useNameResolutionQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        capable.chainIds = new Set(['algorand', 'ethereum'])
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('searches each scope once, lowercasing the name', async () => {
        mockFetchNameSearch.mockResolvedValue([])

        renderHook(
            () => useNameResolutionQuery([ALGORAND, ETHEREUM], 'Alice.ETH'),
            { wrapper },
        )

        await waitFor(() =>
            expect(mockFetchNameSearch).toHaveBeenCalledTimes(2),
        )
        expect(mockFetchNameSearch).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'alice.eth', scope: ALGORAND }),
        )
        expect(mockFetchNameSearch).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'alice.eth', scope: ETHEREUM }),
        )
    })

    it('prefers the first scope that has a match', async () => {
        mockFetchNameSearch.mockImplementation(({ scope }) =>
            Promise.resolve([
                result('x.algo', scope.chainId === 'algorand' ? 'ALGO' : '0x1'),
            ]),
        )

        const { result: hook } = renderHook(
            () => useNameResolutionQuery([ALGORAND, ETHEREUM], 'x.algo'),
            { wrapper },
        )

        await waitFor(() => expect(hook.current.data).toBeDefined())
        expect(hook.current.data?.address).toBe('ALGO')
    })

    it("uses a later scope's match when the first has none", async () => {
        mockFetchNameSearch.mockImplementation(({ scope }) =>
            Promise.resolve(
                scope.chainId === 'ethereum' ? [result('a.eth', '0x1')] : [],
            ),
        )

        const { result: hook } = renderHook(
            () => useNameResolutionQuery([ALGORAND, ETHEREUM], 'a.eth'),
            { wrapper },
        )

        await waitFor(() => expect(hook.current.data?.address).toBe('0x1'))
    })

    it('skips a scope without the nameService capability', async () => {
        capable.chainIds = new Set(['ethereum'])
        mockFetchNameSearch.mockResolvedValue([])

        renderHook(
            () => useNameResolutionQuery([ALGORAND, ETHEREUM], 'a.eth'),
            { wrapper },
        )

        await waitFor(() => expect(mockFetchNameSearch).toHaveBeenCalled())
        expect(mockFetchNameSearch).toHaveBeenCalledTimes(1)
        expect(mockFetchNameSearch).toHaveBeenCalledWith(
            expect.objectContaining({ scope: ETHEREUM }),
        )
    })

    it('makes no request when disabled', () => {
        renderHook(
            () =>
                useNameResolutionQuery([ALGORAND, ETHEREUM], 'a.eth', {
                    enabled: false,
                }),
            { wrapper },
        )

        expect(mockFetchNameSearch).not.toHaveBeenCalled()
    })
})
