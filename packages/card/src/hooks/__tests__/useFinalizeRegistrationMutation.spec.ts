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

const {
    loginRequest,
    acquireCardSessionTokens,
    setCardSession,
    linkOnboardingConsent,
} = vi.hoisted(() => ({
    loginRequest: vi.fn(),
    acquireCardSessionTokens: vi.fn(),
    setCardSession: vi.fn(),
    linkOnboardingConsent: vi.fn(),
}))
vi.mock('../../api/auth', () => ({ loginRequest, acquireCardSessionTokens }))
vi.mock('../../session', () => ({ setCardSession }))
vi.mock('../../api/onboarding', () => ({ linkOnboardingConsent }))

import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { OnboardingStep } from '../../models'
import { useCardStore } from '../../store'
import { useFinalizeRegistrationMutation } from '../useFinalizeRegistrationMutation'

const SCOPE: ChainScope = { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' }

const LOGIN_RESULT = {
    accessToken: 'login-token',
    userId: 'user_1',
    isOtpRequired: false,
    phoneNumber: null,
    phase: null,
    verificationState: 'VERIFIED',
    isLinked: false,
}

describe('useFinalizeRegistrationMutation', () => {
    let queryClient: QueryClient
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    const finalize = async () => {
        const { result } = renderHook(
            () => useFinalizeRegistrationMutation(SCOPE),
            { wrapper },
        )
        const outcome = await result.current.mutateAsync({
            email: 'john@example.com',
            isAutomatic: true,
        })
        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        return outcome
    }

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { mutations: { retry: false } },
        })
        vi.clearAllMocks()
        useCardStore.getState().resetState()
        useCardStore.getState().setPassword('Correct-Horse-1234')
        useCardStore.getState().setOnboardingStep(OnboardingStep.Verification)
        loginRequest.mockResolvedValue(LOGIN_RESULT)
        acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })
        setCardSession.mockResolvedValue(undefined)
        linkOnboardingConsent.mockResolvedValue(undefined)
    })

    it('logs in with the in-memory password, mints the session and links the consent', async () => {
        useCardStore.getState().setConsentSetId('cs_1')

        await expect(finalize()).resolves.toBe('completed')

        expect(loginRequest).toHaveBeenCalledWith({
            email: 'john@example.com',
            password: 'Correct-Horse-1234',
            scope: SCOPE,
        })
        expect(acquireCardSessionTokens).toHaveBeenCalledWith({
            accessToken: 'login-token',
            scope: SCOPE,
        })
        expect(setCardSession).toHaveBeenCalledWith({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })
        expect(linkOnboardingConsent).toHaveBeenCalledWith({
            consentSetId: 'cs_1',
            userId: 'user_1',
            scope: SCOPE,
        })
        const state = useCardStore.getState()
        expect(state.onboardingStep).toBe(OnboardingStep.Completed)
        expect(state.cardUserId).toBe('user_1')
        expect(state.consentSetId).toBeNull()
        expect(state.password).toBeNull()
    })

    it('records every login against the budget, and none without a password', async () => {
        loginRequest.mockResolvedValue({
            ...LOGIN_RESULT,
            accessToken: null,
            phase: 'MAILING_ADDRESS',
        })

        await finalize()

        expect(useCardStore.getState().loginAttempts).toMatchObject({
            automatic: 1,
            total: 1,
            lastAt: expect.any(Number),
        })

        useCardStore.getState().setPassword(null)
        await finalize()
        expect(loginRequest).toHaveBeenCalledTimes(1)
        expect(useCardStore.getState().loginAttempts.automatic).toBe(1)
    })

    it.each([
        [
            'a 403 that says locked',
            { response: { status: 403 }, data: { message: 'Account locked' } },
        ],
        ['a 423', { response: { status: 423 } }],
    ])('stops on %s: locked, password dropped', async (_label, failure) => {
        loginRequest.mockRejectedValue(failure)

        await expect(finalize()).resolves.toBe('locked')

        expect(useCardStore.getState().loginAttempts.isLocked).toBe(true)
        expect(useCardStore.getState().password).toBeNull()
    })

    it('waits out a 429 rate limit instead of reading it as a lock', async () => {
        loginRequest.mockRejectedValue({ response: { status: 429 } })

        await expect(finalize()).resolves.toBe('not-ready')

        expect(useCardStore.getState().loginAttempts.isLocked).toBe(false)
        expect(useCardStore.getState().password).toBe('Correct-Horse-1234')
    })

    it('keeps the consent stash when the link fails, without failing the finalize', async () => {
        useCardStore.getState().setConsentSetId('cs_1')
        linkOnboardingConsent.mockRejectedValue(new Error('network'))

        await expect(finalize()).resolves.toBe('completed')

        expect(useCardStore.getState().consentSetId).toBe('cs_1')
    })

    it('asks for a sign-in when the password is no longer in memory', async () => {
        useCardStore.getState().setPassword(null)

        await expect(finalize()).resolves.toBe('password-required')

        expect(loginRequest).not.toHaveBeenCalled()
        expect(setCardSession).not.toHaveBeenCalled()
    })

    it('asks for a sign-in when Baanx wants a 2FA code', async () => {
        loginRequest.mockResolvedValue({
            ...LOGIN_RESULT,
            accessToken: null,
            isOtpRequired: true,
        })

        await expect(finalize()).resolves.toBe('otp-required')

        expect(setCardSession).not.toHaveBeenCalled()
        expect(useCardStore.getState().password).toBeNull()
    })

    it('asks for a sign-in when the credentials are refused', async () => {
        loginRequest.mockRejectedValue({ response: { status: 401 } })

        await expect(finalize()).resolves.toBe('password-required')

        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Verification,
        )
        expect(useCardStore.getState().password).toBeNull()
    })

    it("reads Baanx's 400 that only lacks the 2FA code as otp-required", async () => {
        loginRequest.mockRejectedValue({
            response: { status: 400 },
            data: { message: 'OTP required', isOtpRequired: true },
        })

        await expect(finalize()).resolves.toBe('otp-required')
    })

    it.each([
        ['a server error', { response: { status: 503 } }],
        ['a network failure', new TypeError('Network request failed')],
    ])('keeps the password for a retry after %s', async (_label, failure) => {
        loginRequest.mockRejectedValue(failure)

        await expect(finalize()).resolves.toBe('not-ready')

        expect(useCardStore.getState().password).toBe('Correct-Horse-1234')
    })

    it('waits when the login names a phase but no token yet', async () => {
        loginRequest.mockResolvedValue({
            ...LOGIN_RESULT,
            accessToken: null,
            phase: 'MAILING_ADDRESS',
        })

        await expect(finalize()).resolves.toBe('not-ready')

        expect(setCardSession).not.toHaveBeenCalled()
        expect(useCardStore.getState().password).toBe('Correct-Horse-1234')
    })

    it('asks for a sign-in when the login answers without a token or phase', async () => {
        loginRequest.mockResolvedValue({ ...LOGIN_RESULT, accessToken: null })

        await expect(finalize()).resolves.toBe('password-required')
    })

    it('drops the password when finishing the session throws', async () => {
        setCardSession.mockRejectedValue(new Error('keystore'))
        const { result } = renderHook(
            () => useFinalizeRegistrationMutation(SCOPE),
            { wrapper },
        )

        await expect(
            result.current.mutateAsync({
                email: 'john@example.com',
                isAutomatic: true,
            }),
        ).rejects.toThrow('keystore')
        await waitFor(() => expect(useCardStore.getState().password).toBeNull())
    })
})
