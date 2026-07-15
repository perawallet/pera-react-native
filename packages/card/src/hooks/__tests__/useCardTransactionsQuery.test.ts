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
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchCardTransactions } = vi.hoisted(() => ({
    fetchCardTransactions: vi.fn(),
}))
vi.mock('../../api/transactions', () => ({ fetchCardTransactions }))

import { useCardTransactionsQuery } from '../useCardTransactionsQuery'

describe('useCardTransactionsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('flattens pages and advances until hasMore is false', async () => {
        fetchCardTransactions
            .mockResolvedValueOnce({
                items: [{ id: 'tx_1' }],
                page: 0,
                hasMore: true,
            })
            .mockResolvedValueOnce({
                items: [{ id: 'tx_2' }],
                page: 1,
                hasMore: false,
            })

        const { result } = renderHook(() => useCardTransactionsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.transactions.map(t => t.id)).toEqual(['tx_1'])
        expect(result.current.hasNextPage).toBe(true)

        act(() => result.current.fetchNextPage())

        await waitFor(() => expect(result.current.transactions).toHaveLength(2))
        expect(result.current.transactions.map(t => t.id)).toEqual([
            'tx_1',
            'tx_2',
        ])
        expect(result.current.hasNextPage).toBe(false)
    })
})
