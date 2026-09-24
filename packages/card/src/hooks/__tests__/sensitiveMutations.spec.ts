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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    onlineManager,
} from '@tanstack/react-query'
import { mutationDefaults } from '@perawallet/wallet-core-shared'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const api = vi.hoisted(() => ({
    fetchCardPinToken: vi.fn(),
    createSetPinSession: vi.fn(),
}))
vi.mock('../../api/card-sensitive', () => api)

import { useCardPinViewMutation } from '../useCardPinViewMutation'
import { useSetCardPinMutation } from '../useSetCardPinMutation'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('sensitive mutation hooks', () => {
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

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    it('useCardPinViewMutation returns the secure view without caching it', async () => {
        api.fetchCardPinToken.mockResolvedValue({
            token: 'tok',
            imageUrl: 'https://host/pin-image?token=tok',
        })

        const { result } = renderHook(() => useCardPinViewMutation(), {
            wrapper,
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.imageUrl).toContain('pin-image')
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    })

    it('useCardPinViewMutation exposes isPaused from the underlying mutation', async () => {
        api.fetchCardPinToken.mockResolvedValue({
            token: 'tok',
            imageUrl: 'https://host/pin-image?token=tok',
        })

        const { result } = renderHook(() => useCardPinViewMutation(), {
            wrapper,
        })

        expect(result.current.isPaused).toBe(false)

        result.current.mutate()
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.isPaused).toBe(false)
    })

    it('useSetCardPinMutation returns the hosted page session', async () => {
        api.createSetPinSession.mockResolvedValue({
            token: 'tok',
            hostedPageUrl: 'https://host/pin-direct/set?token=tok',
        })

        const { result } = renderHook(() => useSetCardPinMutation(), {
            wrapper,
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.hostedPageUrl).toContain('pin-direct/set')
        expect(api.createSetPinSession).toHaveBeenCalledWith({
            network: 'mainnet',
        })
    })

    it('useCardPinViewMutation surfaces the error when the secure-view request fails', async () => {
        api.fetchCardPinToken.mockRejectedValue(new Error('pin token denied'))

        const { result } = renderHook(() => useCardPinViewMutation(), {
            wrapper,
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('pin token denied')
        expect(result.current.data).toBeNull()
    })

    it('useSetCardPinMutation surfaces the error when the session request fails', async () => {
        api.createSetPinSession.mockRejectedValue(
            new Error('set-pin unavailable'),
        )

        const { result } = renderHook(() => useSetCardPinMutation(), {
            wrapper,
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error?.message).toBe('set-pin unavailable')
        expect(result.current.data).toBeNull()
    })

    // OFF-004: offline, the set-PIN session request must fail fast rather than
    // pause and silently auto-resume when connectivity returns.
    it('useSetCardPinMutation rejects promptly offline instead of pausing', async () => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { ...mutationDefaults, retry: false },
            },
        })
        onlineManager.setOnline(false)
        api.createSetPinSession.mockRejectedValue(
            new Error('Network request failed'),
        )

        const { result } = renderHook(() => useSetCardPinMutation(), {
            wrapper,
        })
        result.current.mutate()

        await waitFor(() => expect(result.current.isError).toBe(true))
        // networkMode:'always' ran the mutationFn (which rejected) instead of
        // pausing while offline — proving fail-fast, not pause-and-resume.
        expect(api.createSetPinSession).toHaveBeenCalled()
        expect(queryClient.getMutationCache().getAll()[0]?.state.isPaused).toBe(
            false,
        )
    })
})
