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

const { sendLoginOtpRequest } = vi.hoisted(() => ({
    sendLoginOtpRequest: vi.fn(),
}))
vi.mock('../../api/auth', () => ({ sendLoginOtpRequest }))

import { useSendLoginOtpMutation } from '../useSendLoginOtpMutation'

describe('useSendLoginOtpMutation', () => {
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

    it('requests the login OTP for the user on the active network', async () => {
        sendLoginOtpRequest.mockResolvedValue(undefined)

        const { result } = renderHook(() => useSendLoginOtpMutation(), {
            wrapper,
        })
        result.current.mutate({ userId: 'user-1' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(sendLoginOtpRequest).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1', network: 'mainnet' }),
        )
    })

    it('surfaces a send failure as a mutation error', async () => {
        sendLoginOtpRequest.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useSendLoginOtpMutation(), {
            wrapper,
        })
        result.current.mutate({ userId: 'user-1' })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
