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

const { loginRequest, setCardSession } = vi.hoisted(() => ({
    loginRequest: vi.fn(),
    setCardSession: vi.fn(),
}))
vi.mock('../../api/auth', () => ({ loginRequest }))
vi.mock('../../session', () => ({ setCardSession }))

import { useCardLoginMutation } from '../useCardLoginMutation'

describe('useCardLoginMutation', () => {
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

    it('logs in with the active network and persists an access-token session', async () => {
        loginRequest.mockResolvedValue({
            accessToken: 'a',
            userId: 'u1',
            isOtpRequired: false,
            phase: null,
            verificationState: 'VERIFIED',
            isLinked: true,
        })

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(loginRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'e@x.com',
                password: 'pw',
                network: 'mainnet',
            }),
        )
        expect(setCardSession).toHaveBeenCalledWith(
            expect.objectContaining({ accessToken: 'a', refreshToken: '' }),
        )
    })

    it('does not persist a session while OTP is still required', async () => {
        loginRequest.mockResolvedValue({
            accessToken: null,
            userId: null,
            isOtpRequired: true,
            phase: null,
            verificationState: null,
            isLinked: false,
        })

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(setCardSession).not.toHaveBeenCalled()
        expect(result.current.data?.isOtpRequired).toBe(true)
    })
})
