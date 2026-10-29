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
import { useNfdSearchQuery } from '../useNfdSearchQuery'

const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const
const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const

const mockFetchNfdSearch = vi.hoisted(() => vi.fn())
const nameService = vi.hoisted(() => ({ isEnabled: true }))

vi.mock('../../api', () => ({
    fetchNfdSearch: mockFetchNfdSearch,
}))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useChainCapability: () => nameService.isEnabled,
}))

describe('useNfdSearchQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        vi.clearAllMocks()
        nameService.isEnabled = true
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it.each([ALGORAND_TESTNET, ETHEREUM_SEPOLIA])(
        'lowercases a mixed-case search term and passes the scope for $chainId',
        async scope => {
            mockFetchNfdSearch.mockResolvedValue([])

            renderHook(() => useNfdSearchQuery(scope, 'BruNo.aLgo'), {
                wrapper,
            })

            await waitFor(() => expect(mockFetchNfdSearch).toHaveBeenCalled())

            expect(mockFetchNfdSearch).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'bruno.algo', scope }),
            )
        },
    )

    it('does not fetch while the nameService capability is off', () => {
        nameService.isEnabled = false

        renderHook(() => useNfdSearchQuery(ALGORAND_TESTNET, 'bruno.algo'), {
            wrapper,
        })

        expect(mockFetchNfdSearch).not.toHaveBeenCalled()
    })

    it('does not fetch when disabled', () => {
        renderHook(
            () =>
                useNfdSearchQuery(ALGORAND_TESTNET, 'BruNo.aLgo', {
                    enabled: false,
                }),
            {
                wrapper,
            },
        )

        expect(mockFetchNfdSearch).not.toHaveBeenCalled()
    })
    it('returns one stable empty array while disabled', () => {
        const { result, rerender } = renderHook(
            () =>
                useNfdSearchQuery(ALGORAND_TESTNET, 'bruno.algo', {
                    enabled: false,
                }),
            { wrapper },
        )
        const initialData = result.current.data

        rerender()

        expect(initialData).toEqual([])
        expect(result.current.data).toBe(initialData)
    })
})
