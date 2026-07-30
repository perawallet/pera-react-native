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

const {
    loginRequest,
    acquireCardSessionTokens,
    setCardSession,
    fetchOnboardingDetails,
    setOnboardingId,
} = vi.hoisted(() => ({
    loginRequest: vi.fn(),
    acquireCardSessionTokens: vi.fn(),
    setCardSession: vi.fn(),
    fetchOnboardingDetails: vi.fn(),
    setOnboardingId: vi.fn(),
}))
vi.mock('../../api/auth', () => ({
    loginRequest,
    acquireCardSessionTokens,
}))
vi.mock('../../session', () => ({ setCardSession }))
vi.mock('../../api/onboarding', () => ({ fetchOnboardingDetails }))
vi.mock('../../store', () => ({
    useCardStore: { getState: () => ({ setOnboardingId }) },
}))

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

    it('logs in, completes the OAuth exchange, and persists the token pair', async () => {
        loginRequest.mockResolvedValue({
            accessToken: 'ephemeral-login-token',
            userId: 'u1',
            isOtpRequired: false,
            phase: null,
            verificationState: 'VERIFIED',
            isLinked: true,
        })
        acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
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
        // The exchange runs with the ephemeral login token…
        expect(acquireCardSessionTokens).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: 'ephemeral-login-token',
                network: 'mainnet',
            }),
        )
        // …and the durable OAuth pair is what gets persisted.
        expect(setCardSession).toHaveBeenCalledTimes(1)
        expect(setCardSession).toHaveBeenCalledWith({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })
        // A complete account never touches the onboarding bridge.
        expect(fetchOnboardingDetails).not.toHaveBeenCalled()
        expect(setOnboardingId).not.toHaveBeenCalled()
    })

    it('persists the fallback pair when the OAuth exchange degrades', async () => {
        // acquireCardSessionTokens absorbs exchange failures and returns the
        // refresh-less pair — the login itself must still succeed.
        loginRequest.mockResolvedValue({
            accessToken: 'ephemeral-login-token',
            userId: 'u1',
            isOtpRequired: false,
            phase: null,
            verificationState: 'VERIFIED',
            isLinked: true,
        })
        acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'ephemeral-login-token',
            refreshToken: '',
        })

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(setCardSession).toHaveBeenCalledWith({
            accessToken: 'ephemeral-login-token',
            refreshToken: '',
        })
    })

    it('does not persist a session while OTP is still required', async () => {
        loginRequest.mockResolvedValue({
            accessToken: null,
            userId: 'u1',
            isOtpRequired: true,
            phase: null,
            verificationState: null,
            isLinked: false,
        })

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(acquireCardSessionTokens).not.toHaveBeenCalled()
        expect(setCardSession).not.toHaveBeenCalled()
        expect(fetchOnboardingDetails).not.toHaveBeenCalled()
        expect(setOnboardingId).not.toHaveBeenCalled()
        expect(result.current.data?.isOtpRequired).toBe(true)
        expect(result.current.data?.tokens).toBeNull()
    })

    it('resolves KYC state and bridges userId to onboardingId for a mid-onboarding login', async () => {
        loginRequest.mockResolvedValue({
            accessToken: null,
            userId: 'user-123',
            isOtpRequired: false,
            phase: 'PERSONAL_INFORMATION',
            verificationState: null,
            isLinked: false,
        })
        fetchOnboardingDetails.mockResolvedValue({
            verificationState: 'UNVERIFIED',
        })

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        // userId is treated as the onboardingId for the pre-auth lookup.
        expect(fetchOnboardingDetails).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'user-123',
                network: 'mainnet',
            }),
        )
        // The resolved state is merged into the result, and the bridge is set.
        expect(result.current.data?.verificationState).toBe('UNVERIFIED')
        expect(setOnboardingId).toHaveBeenCalledWith('user-123')
        expect(setCardSession).not.toHaveBeenCalled()
    })

    it('still bridges the onboardingId when the KYC lookup fails', async () => {
        loginRequest.mockResolvedValue({
            accessToken: null,
            userId: 'user-123',
            isOtpRequired: false,
            phase: 'PERSONAL_INFORMATION',
            verificationState: null,
            isLinked: false,
        })
        fetchOnboardingDetails.mockRejectedValue(new Error('not found'))

        const { result } = renderHook(() => useCardLoginMutation(), { wrapper })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        // The login result is kept (state stays null → caller treats unverified)
        // but the onboardingId bridge still happens.
        expect(result.current.data?.verificationState).toBeNull()
        expect(setOnboardingId).toHaveBeenCalledWith('user-123')
    })
})
