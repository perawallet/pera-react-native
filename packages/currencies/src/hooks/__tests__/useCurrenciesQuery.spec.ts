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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCurrenciesQuery } from '../useCurrenciesQuery'
import React from 'react'

const ALGORAND_TESTNET = { chainId: 'algorand', networkId: 'testnet' } as const
const ETHEREUM_SEPOLIA = { chainId: 'ethereum', networkId: 'sepolia' } as const

const DESCRIPTORS = {
    algorand: { displayName: 'Algorand', nativeAsset: { symbol: 'ALGO' } },
    ethereum: { displayName: 'Ethereum', nativeAsset: { symbol: 'ETH' } },
} as const

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        chains: {
            get: (chainId: keyof typeof DESCRIPTORS) => ({
                descriptor: DESCRIPTORS[chainId],
            }),
        },
    }),
}))

const mockFetchCurrenciesList = vi.hoisted(() => vi.fn())
vi.mock('../../api/currencies', () => ({
    fetchCurrenciesList: mockFetchCurrenciesList,
}))

describe('useCurrenciesQuery', () => {
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
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it.each([
        [ALGORAND_TESTNET, { id: 'ALGO', name: 'Algorand', symbol: 'ALGO' }],
        [ETHEREUM_SEPOLIA, { id: 'ETH', name: 'Ethereum', symbol: 'ETH' }],
    ])(
        'requests the scope and prepends its native currency (%o)',
        async (scope, nativeCurrency) => {
            const mockData = [
                { id: 'USD', name: 'US Dollar', symbol: '$' },
                { id: 'EUR', name: 'Euro', symbol: '€' },
            ]
            mockFetchCurrenciesList.mockResolvedValue(mockData)

            const { result } = renderHook(() => useCurrenciesQuery(scope), {
                wrapper,
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(mockFetchCurrenciesList).toHaveBeenCalledWith(
                expect.objectContaining({ scope }),
            )
            expect(result.current.data).toEqual([nativeCurrency, ...mockData])
        },
    )

    it('handles empty response', async () => {
        mockFetchCurrenciesList.mockResolvedValue([])

        const { result } = renderHook(
            () => useCurrenciesQuery(ALGORAND_TESTNET),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual([
            { id: 'ALGO', name: 'Algorand', symbol: 'ALGO' },
        ])
    })

    it('handles loading state', () => {
        mockFetchCurrenciesList.mockImplementation(() => new Promise(() => {}))

        const { result } = renderHook(
            () => useCurrenciesQuery(ALGORAND_TESTNET),
            { wrapper },
        )

        expect(result.current.isPending).toBe(true)
    })
})
