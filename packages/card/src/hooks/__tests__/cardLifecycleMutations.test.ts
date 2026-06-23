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

const api = vi.hoisted(() => ({
    freezeCard: vi.fn(),
    unfreezeCard: vi.fn(),
}))
vi.mock('../../api/card', () => api)

import { useFreezeCardMutation } from '../useFreezeCardMutation'
import { useUnfreezeCardMutation } from '../useUnfreezeCardMutation'
import { cardQueryKeys } from '../querykeys'
import { CardStatus, type Card } from '../../models/card'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('card lifecycle mutation hooks', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        api.freezeCard.mockResolvedValue(undefined)
        api.unfreezeCard.mockResolvedValue(undefined)
    })

    it('useFreezeCardMutation freezes and invalidates card status', async () => {
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useFreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.freezeCard).toHaveBeenCalledWith({ network: 'mainnet' })
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['card', 'status']),
            }),
        )
    })

    it('useUnfreezeCardMutation unfreezes and invalidates card status', async () => {
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useUnfreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.unfreezeCard).toHaveBeenCalledWith({ network: 'mainnet' })
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['card', 'status']),
            }),
        )
    })

    it('useFreezeCardMutation marks the cached card frozen on success', async () => {
        const key = cardQueryKeys.status('mainnet')
        queryClient.setQueryData<Card>(key, {
            status: CardStatus.Active,
        } as Card)
        const { result } = renderHook(() => useFreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(queryClient.getQueryData<Card>(key)?.status).toBe(
            CardStatus.Frozen,
        )
    })

    it('useUnfreezeCardMutation clears the frozen state on success', async () => {
        const key = cardQueryKeys.status('mainnet')
        queryClient.setQueryData<Card>(key, {
            status: CardStatus.Frozen,
        } as Card)
        const { result } = renderHook(() => useUnfreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(queryClient.getQueryData<Card>(key)?.status).toBe(
            CardStatus.Active,
        )
    })

    it('useFreezeCardMutation surfaces the error and skips status invalidation on failure', async () => {
        api.freezeCard.mockRejectedValue(new Error('freeze failed'))
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useFreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('freeze failed')
        expect(invalidate).not.toHaveBeenCalled()
    })

    it('useUnfreezeCardMutation surfaces the error and skips status invalidation on failure', async () => {
        api.unfreezeCard.mockRejectedValue(new Error('unfreeze failed'))
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useUnfreezeCardMutation(), {
            wrapper,
        })

        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('unfreeze failed')
        expect(invalidate).not.toHaveBeenCalled()
    })
})
