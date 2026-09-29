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

const { requestPasswordReset, verifyPasswordReset, confirmPasswordReset } =
    vi.hoisted(() => ({
        requestPasswordReset: vi.fn(),
        verifyPasswordReset: vi.fn(),
        confirmPasswordReset: vi.fn(),
    }))
vi.mock('../../api/auth', () => ({
    requestPasswordReset,
    verifyPasswordReset,
    confirmPasswordReset,
}))

import { useRequestPasswordResetMutation } from '../useRequestPasswordResetMutation'
import { useVerifyPasswordResetMutation } from '../useVerifyPasswordResetMutation'
import { useConfirmPasswordResetMutation } from '../useConfirmPasswordResetMutation'

describe('password reset mutations', () => {
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

    it('requests the reset code on the active network', async () => {
        requestPasswordReset.mockResolvedValue(undefined)

        const { result } = renderHook(() => useRequestPasswordResetMutation(), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(requestPasswordReset).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'e@x.com', network: 'mainnet' }),
        )
    })

    it('surfaces a request failure as a mutation error', async () => {
        requestPasswordReset.mockRejectedValue(new Error('boom'))

        const { result } = renderHook(() => useRequestPasswordResetMutation(), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com' })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('verifies the code and exposes the reset token as data', async () => {
        verifyPasswordReset.mockResolvedValue('reset-token-1')

        const { result } = renderHook(() => useVerifyPasswordResetMutation(), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', code: '123456' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(verifyPasswordReset).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'e@x.com',
                code: '123456',
                network: 'mainnet',
            }),
        )
        expect(result.current.data).toBe('reset-token-1')
    })

    it('confirms the reset on the active network', async () => {
        confirmPasswordReset.mockResolvedValue(undefined)

        const { result } = renderHook(() => useConfirmPasswordResetMutation(), {
            wrapper,
        })
        result.current.mutate({
            token: 'reset-token-1',
            password: 'aA1!aA1!aA1!aA1',
            confirmPassword: 'aA1!aA1!aA1!aA1',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(confirmPasswordReset).toHaveBeenCalledWith(
            expect.objectContaining({
                token: 'reset-token-1',
                network: 'mainnet',
            }),
        )
    })
})
