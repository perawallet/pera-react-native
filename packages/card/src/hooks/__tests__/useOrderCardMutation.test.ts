/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { orderCard } = vi.hoisted(() => ({ orderCard: vi.fn() }))
vi.mock('../../api/card', () => ({ orderCard }))

import { useOrderCardMutation } from '../useOrderCardMutation'

describe('useOrderCardMutation', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
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

    it('orders a card and invalidates the card status query', async () => {
        orderCard.mockResolvedValue(undefined)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useOrderCardMutation(), { wrapper })
        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(orderCard).toHaveBeenCalledWith({ network: 'mainnet' })
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['card', 'status']),
            }),
        )
    })
})
