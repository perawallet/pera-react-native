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
import { OnboardingStep } from '../../models'

const {
    loginRequest,
    acquireCardSessionTokens,
    setCardSession,
    fetchOnboardingDetails,
    setOnboardingId,
    adoptCardUser,
    setOnboardingStep,
    setPassword,
    setConsentSetId,
    setCountryIso,
    clearLoginSecrets,
    recordLoginAttempt,
    markLoginLocked,
    linkOnboardingConsent,
    storeState,
} = vi.hoisted(() => ({
    clearLoginSecrets: vi.fn(),
    recordLoginAttempt: vi.fn(),
    markLoginLocked: vi.fn(),
    setCountryIso: vi.fn(),
    loginRequest: vi.fn(),
    acquireCardSessionTokens: vi.fn(),
    setCardSession: vi.fn(),
    adoptCardUser: vi.fn(),
    setOnboardingStep: vi.fn(),
    fetchOnboardingDetails: vi.fn(),
    setOnboardingId: vi.fn(),
    setPassword: vi.fn(),
    setConsentSetId: vi.fn(),
    linkOnboardingConsent: vi.fn(),
    storeState: {
        consentSetId: null as string | null,
        countryIso: null as string | null,
    },
}))
vi.mock('../../api/auth', () => ({
    loginRequest,
    acquireCardSessionTokens,
}))
vi.mock('../../session', () => ({ setCardSession }))
vi.mock('../../api/onboarding', () => ({
    fetchOnboardingDetails,
    linkOnboardingConsent,
}))
vi.mock('../../store', () => ({
    useCardStore: {
        getState: () => ({
            ...storeState,
            setOnboardingId,
            adoptCardUser,
            setOnboardingStep,
            setPassword,
            setConsentSetId,
            setCountryIso,
            clearLoginSecrets,
            recordLoginAttempt,
            markLoginLocked,
        }),
    },
}))

import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useCardLoginMutation } from '../useCardLoginMutation'

const SCOPES: ChainScope[] = [
    { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
    { chainId: 'ethereum', networkId: 'sepolia' },
]

describe.each(SCOPES)('useCardLoginMutation ($chainId)', SCOPE => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        storeState.consentSetId = null
        storeState.countryIso = null
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

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(loginRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'e@x.com',
                password: 'pw',
                scope: SCOPE,
            }),
        )
        // The exchange runs with the ephemeral login token…
        expect(acquireCardSessionTokens).toHaveBeenCalledWith(
            expect.objectContaining({
                accessToken: 'ephemeral-login-token',
                scope: SCOPE,
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
        // The device's setup state is scoped to the user who just signed in.
        expect(adoptCardUser).toHaveBeenCalledWith('u1')
        // A token means registration finished: the checklist's details step is done.
        expect(setOnboardingStep).toHaveBeenCalledWith(OnboardingStep.Completed)
        expect(clearLoginSecrets).toHaveBeenCalled()
        // Nothing was stashed, so there is nothing to link.
        expect(linkOnboardingConsent).not.toHaveBeenCalled()
    })

    it('links the consent stashed during onboarding when the sign-in finishes this registration', async () => {
        storeState.consentSetId = 'cs_1'
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
        linkOnboardingConsent.mockResolvedValue(undefined)

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({
            email: 'e@x.com',
            password: 'pw',
            linkConsent: true,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(linkOnboardingConsent).toHaveBeenCalledWith({
            consentSetId: 'cs_1',
            userId: 'u1',
            scope: SCOPE,
        })
        expect(setConsentSetId).toHaveBeenCalledWith(null)
    })

    it('never binds a stale stash to a plain sign-in', async () => {
        // Left behind by an abandoned sign-up for another email.
        storeState.consentSetId = 'cs_stale'
        loginRequest.mockResolvedValue({
            accessToken: 'ephemeral-login-token',
            userId: 'someone-else',
            isOtpRequired: false,
            phase: null,
            verificationState: 'VERIFIED',
            isLinked: true,
        })
        acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'b@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(linkOnboardingConsent).not.toHaveBeenCalled()
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

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
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

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
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
            countryOfResidence: 'US',
        })

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        // userId is treated as the onboardingId for the pre-auth lookup.
        expect(fetchOnboardingDetails).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'user-123',
                scope: SCOPE,
            }),
        )
        // The resolved state is merged into the result, and the bridge is set.
        expect(result.current.data?.verificationState).toBe('UNVERIFIED')
        expect(setOnboardingId).toHaveBeenCalledWith('user-123')
        expect(setCardSession).not.toHaveBeenCalled()
        // The device had no residence; the record's is adopted for routing.
        expect(setCountryIso).toHaveBeenCalledWith('US')
        // Held for the login that creates the session once KYC verifies.
        expect(setPassword).toHaveBeenCalledWith('pw')
        // Baanx counts it as a failed login, so the budget spaces from it.
        expect(recordLoginAttempt).toHaveBeenCalledWith({
            isAutomatic: false,
            at: expect.any(Number),
        })
    })

    it("keeps this device's residence over the record's", async () => {
        storeState.countryIso = 'GB'
        loginRequest.mockResolvedValue({
            accessToken: null,
            userId: 'user-123',
            isOtpRequired: false,
            phase: 'PHYSICAL_ADDRESS',
            verificationState: 'UNVERIFIED',
            isLinked: false,
        })
        fetchOnboardingDetails.mockResolvedValue({
            verificationState: 'UNVERIFIED',
            countryOfResidence: 'US',
        })

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data?.countryOfResidence).toBe('US')
        expect(setCountryIso).not.toHaveBeenCalled()
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

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        // The login result is kept (state stays null → caller treats unverified)
        // but the onboardingId bridge still happens.
        expect(result.current.data?.verificationState).toBeNull()
        expect(setOnboardingId).toHaveBeenCalledWith('user-123')
    })

    it('marks the account locked when Baanx says so', async () => {
        loginRequest.mockRejectedValue({
            response: { status: 403 },
            data: { message: 'Account locked. Contact support@baanx.com' },
        })

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(markLoginLocked).toHaveBeenCalled()
    })

    it('leaves the lock alone for an ordinary refusal', async () => {
        loginRequest.mockRejectedValue({ response: { status: 401 } })

        const { result } = renderHook(() => useCardLoginMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate({ email: 'e@x.com', password: 'pw' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(markLoginLocked).not.toHaveBeenCalled()
    })
})
