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
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { orderCard } = vi.hoisted(() => ({ orderCard: vi.fn() }))
vi.mock('../../api/card', async () => ({
    ...(await vi.importActual('../../api/card')),
    orderCard,
}))

import { useOrderCardMutation } from '../useOrderCardMutation'
import { CardOrderNotVerifiedError } from '../../api/card'
import { cardMutationKeys } from '../querykeys'

/** A ky-shaped rejection whose body getCardApiError can read. */
const baanxError = (status: number, body: Record<string, unknown>) => ({
    data: body,
    response: { status },
})

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

    it('registers under the shared order mutation key while in flight', async () => {
        let resolveOrder: () => void = () => {}
        orderCard.mockImplementation(
            () =>
                new Promise<void>(resolve => {
                    resolveOrder = resolve
                }),
        )

        const { result } = renderHook(() => useOrderCardMutation(), { wrapper })
        result.current.mutate()

        await waitFor(() =>
            expect(
                queryClient.isMutating({
                    mutationKey: cardMutationKeys.order,
                }),
            ).toBe(1),
        )
        resolveOrder()
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('treats "already has a card" as success and still invalidates status', async () => {
        orderCard.mockRejectedValue(
            baanxError(400, {
                message: 'User already has a card',
                code: 'CARD_EXISTS',
            }),
        )
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useOrderCardMutation(), { wrapper })
        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['card', 'status']),
            }),
        )
    })

    it('rejects a not-verified refusal as CardOrderNotVerifiedError and refreshes the user cache', async () => {
        orderCard.mockRejectedValue(
            baanxError(403, { message: 'Account has not been verified' }),
        )
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderHook(() => useOrderCardMutation(), { wrapper })
        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(CardOrderNotVerifiedError)
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['card', 'user']),
            }),
        )
    })

    it('rethrows unrelated failures untouched', async () => {
        const failure = baanxError(500, { message: 'Internal error' })
        orderCard.mockRejectedValue(failure)

        const { result } = renderHook(() => useOrderCardMutation(), { wrapper })
        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).not.toBeInstanceOf(
            CardOrderNotVerifiedError,
        )
    })
})
