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

const api = vi.hoisted(() => ({
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
    sendPhoneVerification: vi.fn(),
    verifyPhone: vi.fn(),
    submitPersonalDetails: vi.fn(),
    submitAddress: vi.fn(),
    submitOnboardingConsent: vi.fn(),
    linkOnboardingConsent: vi.fn(),
    connectFundingSource: vi.fn(),
}))
vi.mock('../../api/onboarding', () => api)

const session = vi.hoisted(() => ({ setCardSession: vi.fn() }))
vi.mock('../../session', () => session)

const auth = vi.hoisted(() => ({ acquireCardSessionTokens: vi.fn() }))
vi.mock('../../api/auth', () => auth)

import { useSendEmailVerificationMutation } from '../useSendEmailVerificationMutation'
import { useVerifyEmailMutation } from '../useVerifyEmailMutation'
import { useSendPhoneVerificationMutation } from '../useSendPhoneVerificationMutation'
import { useVerifyPhoneMutation } from '../useVerifyPhoneMutation'
import { useSubmitPersonalDetailsMutation } from '../useSubmitPersonalDetailsMutation'
import { useSubmitAddressMutation } from '../useSubmitAddressMutation'
import { useSubmitConsentMutation } from '../useSubmitConsentMutation'
import { useLinkConsentMutation } from '../useLinkConsentMutation'
import { useConnectFundingSourceMutation } from '../useConnectFundingSourceMutation'
import { useCardStore } from '../../store'
import { OnboardingStep } from '../../models'
import { OnboardingNotVerifiedError } from '../../api/errors'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe('onboarding mutation hooks', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
        Object.values(api).forEach(fn => fn.mockResolvedValue(undefined))
        // The address step returns a token-bearing body the mutation reads.
        api.submitAddress.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'ob_1',
            userId: 'user_1',
        })
        // Consent create returns the set id the hook stashes for the link step.
        api.submitOnboardingConsent.mockResolvedValue({ consentSetId: 'cs_1' })
        session.setCardSession.mockResolvedValue(undefined)
        // The registration token is traded for the durable OAuth pair.
        auth.acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })
        useCardStore.getState().resetState()
    })

    it('useSendEmailVerificationMutation posts the email and stores the verification id', async () => {
        api.sendEmailVerification.mockResolvedValue({
            contactVerificationId: 'cv_new',
        })
        const { result } = renderHook(
            () => useSendEmailVerificationMutation(),
            {
                wrapper,
            },
        )
        result.current.mutate({ email: 'e@x.com' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.sendEmailVerification).toHaveBeenCalledWith({
            email: 'e@x.com',
            network: 'mainnet',
        })
        expect(useCardStore.getState().contactVerificationId).toBe('cv_new')
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.EmailVerify,
        )
    })

    it('useVerifyEmailMutation forwards the payload and stores the onboarding id', async () => {
        api.verifyEmail.mockResolvedValue({ onboardingId: 'ob_new' })
        const { result } = renderHook(() => useVerifyEmailMutation(), {
            wrapper,
        })
        result.current.mutate({
            email: 'e@x.com',
            password: 'pw',
            verificationCode: '123456',
            contactVerificationId: 'cv_1',
            countryOfResidence: 'GB',
            allowMarketing: true,
            allowSms: false,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.verifyEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                verificationCode: '123456',
                contactVerificationId: 'cv_1',
                allowMarketing: true,
                allowSms: false,
                network: 'mainnet',
            }),
        )
        expect(useCardStore.getState().onboardingId).toBe('ob_new')
        // email/verify only stores the onboarding id — it doesn't advance the
        // step. The phone/send and phone/verify calls that follow move it on.
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.EmailSend,
        )
    })

    it('useSendPhoneVerificationMutation forwards phone fields', async () => {
        const { result } = renderHook(
            () => useSendPhoneVerificationMutation(),
            {
                wrapper,
            },
        )
        result.current.mutate({
            phoneCountryCode: '+44',
            phoneNumber: '7400846282',
            contactVerificationId: 'cv_1',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.sendPhoneVerification).toHaveBeenCalledWith(
            expect.objectContaining({
                phoneNumber: '7400846282',
                network: 'mainnet',
            }),
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.PhoneVerify,
        )
    })

    it('useVerifyPhoneMutation forwards the code and advances to verification', async () => {
        const { result } = renderHook(() => useVerifyPhoneMutation(), {
            wrapper,
        })
        result.current.mutate({
            onboardingId: 'ob_1',
            phoneCountryCode: '+44',
            phoneNumber: '7400846282',
            contactVerificationId: 'cv_1',
            verificationCode: '654321',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.verifyPhone).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'ob_1',
                verificationCode: '654321',
                network: 'mainnet',
            }),
        )
        // Phone verified → the KYC (verification) step comes next.
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Verification,
        )
    })

    it('useSubmitPersonalDetailsMutation wraps the details with the network', async () => {
        const details = {
            onboardingId: 'ob_1',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '2000-01-01',
            countryOfNationality: 'GB',
        }
        const { result } = renderHook(
            () => useSubmitPersonalDetailsMutation(),
            {
                wrapper,
            },
        )
        result.current.mutate(details)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitPersonalDetails).toHaveBeenCalledWith({
            details,
            network: 'mainnet',
        })
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Address,
        )
    })

    // Baanx refuses registration steps until the identity check is far enough
    // along. It reports PENDING from the moment a Veriff session is created,
    // so this refusal is the only trustworthy signal: it has to reach the
    // screen as a typed error, and it must invalidate the cached KYC record.
    const NOT_VERIFIED_FAILURE = {
        response: { status: 400 },
        data: { message: 'User is not verified' },
    }

    it('useSubmitPersonalDetailsMutation types a not-verified refusal and refreshes the onboarding record', async () => {
        api.submitPersonalDetails.mockRejectedValue(NOT_VERIFIED_FAILURE)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(
            () => useSubmitPersonalDetailsMutation(),
            { wrapper },
        )

        result.current.mutate({
            onboardingId: 'ob_1',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '2000-01-01',
            countryOfNationality: 'GB',
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(OnboardingNotVerifiedError)
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['onboarding-details']),
            }),
        )
        // The step must not advance on a refusal.
        expect(useCardStore.getState().onboardingStep).not.toBe(
            OnboardingStep.Address,
        )
    })

    const address = {
        onboardingId: 'ob_1',
        addressLine1: '23 Werrington Bridge Rd',
        city: 'Peterborough',
        zip: 'PE6 7PP',
        isSameMailingAddress: true,
    }

    it('useSubmitAddressMutation types a not-verified refusal and refreshes the onboarding record', async () => {
        api.submitAddress.mockRejectedValue(NOT_VERIFIED_FAILURE)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useSubmitAddressMutation(), {
            wrapper,
        })

        result.current.mutate(address)

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(OnboardingNotVerifiedError)
        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                queryKey: expect.arrayContaining(['onboarding-details']),
            }),
        )
        expect(session.setCardSession).not.toHaveBeenCalled()
    })

    it('useSubmitAddressMutation exchanges the registration token for the OAuth pair and completes onboarding', async () => {
        api.submitAddress.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'ob_1',
        })
        const { result } = renderHook(() => useSubmitAddressMutation(), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitAddress).toHaveBeenCalledWith({
            address,
            network: 'mainnet',
        })
        // The registration-issued token is only used to complete the OAuth
        // flow; the persisted session is the durable access+refresh pair.
        expect(auth.acquireCardSessionTokens).toHaveBeenCalledWith({
            accessToken: 'tok',
            network: 'mainnet',
        })
        expect(session.setCardSession).toHaveBeenCalledTimes(1)
        expect(session.setCardSession).toHaveBeenCalledWith({
            accessToken: 'oauth-access',
            refreshToken: 'oauth-refresh',
        })
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Completed,
        )
    })

    it('useSubmitAddressMutation persists the fallback pair when the OAuth exchange degrades', async () => {
        // acquireCardSessionTokens absorbs exchange failures and returns the
        // refresh-less pair — registration completion must not be stranded.
        api.submitAddress.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'ob_1',
        })
        auth.acquireCardSessionTokens.mockResolvedValue({
            accessToken: 'tok',
            refreshToken: '',
        })
        const { result } = renderHook(() => useSubmitAddressMutation(), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(session.setCardSession).toHaveBeenCalledWith({
            accessToken: 'tok',
            refreshToken: '',
        })
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Completed,
        )
    })

    it('useSubmitAddressMutation skips the session commit when no token is issued', async () => {
        // The US separate-mailing path returns accessToken: null (the mailing
        // step issues the token); onboarding is still marked complete.
        api.submitAddress.mockResolvedValue({
            accessToken: null,
            onboardingId: 'ob_1',
        })
        const { result } = renderHook(() => useSubmitAddressMutation(), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(auth.acquireCardSessionTokens).not.toHaveBeenCalled()
        expect(session.setCardSession).not.toHaveBeenCalled()
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Completed,
        )
    })

    it('useSubmitConsentMutation forwards the payload, stashes the consentSetId, and does not advance the step', async () => {
        const stepBefore = useCardStore.getState().onboardingStep
        const { result } = renderHook(() => useSubmitConsentMutation(), {
            wrapper,
        })
        result.current.mutate({
            onboardingId: 'ob_1',
            allowMarketing: true,
            allowSms: false,
            cardTermsAccepted: true,
            platformTermsAccepted: true,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitOnboardingConsent).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'ob_1',
                allowMarketing: true,
                allowSms: false,
                cardTermsAccepted: true,
                platformTermsAccepted: true,
                network: 'mainnet',
            }),
        )
        // The created consent set id is stashed for the link step.
        expect(useCardStore.getState().consentSetId).toBe('cs_1')
        // Consent is part of the final address step — it must not advance the
        // onboarding step on its own.
        expect(useCardStore.getState().onboardingStep).toBe(stepBefore)
    })

    it('useSubmitConsentMutation does not overwrite a stashed id when a duplicate returns none', async () => {
        // A duplicate-onboardingId retry resolves with consentSetId: null; the id
        // stashed on the first create must survive for the link step.
        useCardStore.getState().setConsentSetId('cs_first')
        api.submitOnboardingConsent.mockResolvedValue({ consentSetId: null })
        const { result } = renderHook(() => useSubmitConsentMutation(), {
            wrapper,
        })
        result.current.mutate({
            onboardingId: 'ob_1',
            allowMarketing: true,
            cardTermsAccepted: true,
            platformTermsAccepted: true,
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(useCardStore.getState().consentSetId).toBe('cs_first')
    })

    it('useLinkConsentMutation forwards the consentSetId and userId', async () => {
        const { result } = renderHook(() => useLinkConsentMutation(), {
            wrapper,
        })
        result.current.mutate({ consentSetId: 'cs_1', userId: 'user_1' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.linkOnboardingConsent).toHaveBeenCalledWith({
            consentSetId: 'cs_1',
            userId: 'user_1',
            network: 'mainnet',
        })
    })

    it('useConnectFundingSourceMutation links the account and stores its address', async () => {
        api.connectFundingSource.mockResolvedValue({
            fundingSourceId: 'fs_1',
        })
        const { result } = renderHook(() => useConnectFundingSourceMutation(), {
            wrapper,
        })
        result.current.mutate({ address: 'ALGO_ADDRESS' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.connectFundingSource).toHaveBeenCalledWith({
            address: 'ALGO_ADDRESS',
            network: 'mainnet',
        })
        // The connected account address (not the fabricated id) is persisted so
        // the checklist's Connect Funds row renders its done state.
        expect(useCardStore.getState().connectedFundingSourceAddress).toBe(
            'ALGO_ADDRESS',
        )
    })

    it('useConnectFundingSourceMutation leaves the store untouched on failure', async () => {
        api.connectFundingSource.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useConnectFundingSourceMutation(), {
            wrapper,
        })
        result.current.mutate({ address: 'ALGO_ADDRESS' })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(useCardStore.getState().connectedFundingSourceAddress).toBeNull()
    })
})
