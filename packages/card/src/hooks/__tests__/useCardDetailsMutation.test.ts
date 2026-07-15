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

const { fetchCardDetailsToken } = vi.hoisted(() => ({
    fetchCardDetailsToken: vi.fn(),
}))
vi.mock('../../api/card-sensitive', () => ({ fetchCardDetailsToken }))

import { useCardDetailsMutation } from '../useCardDetailsMutation'

describe('useCardDetailsMutation', () => {
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

    afterEach(() => {
        onlineManager.setOnline(true)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('returns the secure view and writes nothing to the query cache', async () => {
        fetchCardDetailsToken.mockResolvedValue({
            token: 'tok-1',
            imageUrl: 'https://host/details-image?token=tok-1',
        })

        const { result } = renderHook(() => useCardDetailsMutation(), {
            wrapper,
        })
        result.current.mutate({})

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.imageUrl).toContain('details-image')
        // The sensitive result must never enter the query cache.
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
        expect(fetchCardDetailsToken).toHaveBeenCalledWith({
            network: 'mainnet',
            customCss: undefined,
        })
    })

    it('forwards customCss to the details/token request', async () => {
        fetchCardDetailsToken.mockResolvedValue({
            token: 'tok-1',
            imageUrl: 'https://host/details-image?token=tok-1',
        })
        const customCss = {
            cardBackgroundColor: '#FCCA44',
            panBackgroundColor: '#FFE858',
        }

        const { result } = renderHook(() => useCardDetailsMutation(), {
            wrapper,
        })
        result.current.mutate({ customCss })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(fetchCardDetailsToken).toHaveBeenCalledWith({
            network: 'mainnet',
            customCss,
        })
    })

    // OFF-004: offline, the mutation must fail fast (run the mutationFn and let
    // the transport reject) rather than pause and silently auto-resume.
    it('rejects promptly offline instead of pausing', async () => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { ...mutationDefaults, retry: false },
            },
        })
        onlineManager.setOnline(false)
        fetchCardDetailsToken.mockRejectedValue(
            new Error('Network request failed'),
        )

        const { result } = renderHook(() => useCardDetailsMutation(), {
            wrapper,
        })
        result.current.mutate({})

        await waitFor(() => expect(result.current.isError).toBe(true))
        // networkMode:'always' means the mutationFn ran (rejecting) instead of
        // pausing while offline — proving fail-fast, not pause-and-resume.
        expect(fetchCardDetailsToken).toHaveBeenCalled()
        expect(queryClient.getMutationCache().getAll()[0]?.state.isPaused).toBe(
            false,
        )
    })
})
