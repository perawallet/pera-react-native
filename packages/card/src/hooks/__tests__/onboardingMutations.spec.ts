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

const api = vi.hoisted(() => ({
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
    sendPhoneVerification: vi.fn(),
    verifyPhone: vi.fn(),
    submitPersonalDetails: vi.fn(),
    submitAdditionalDetails: vi.fn(),
    submitAddress: vi.fn(),
    submitMailingAddress: vi.fn(),
    submitOnboardingConsent: vi.fn(),
    linkOnboardingConsent: vi.fn(),
}))
vi.mock('../../api/onboarding', () => api)

const session = vi.hoisted(() => ({ setCardSession: vi.fn() }))
vi.mock('../../session', () => session)

const auth = vi.hoisted(() => ({ acquireCardSessionTokens: vi.fn() }))
vi.mock('../../api/auth', () => auth)

import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useSendEmailVerificationMutation } from '../useSendEmailVerificationMutation'
import { useVerifyEmailMutation } from '../useVerifyEmailMutation'
import { useSendPhoneVerificationMutation } from '../useSendPhoneVerificationMutation'
import { useVerifyPhoneMutation } from '../useVerifyPhoneMutation'
import { useSubmitPersonalDetailsMutation } from '../useSubmitPersonalDetailsMutation'
import { useSubmitAdditionalDetailsMutation } from '../useSubmitAdditionalDetailsMutation'
import { useSubmitAddressMutation } from '../useSubmitAddressMutation'
import { useSubmitMailingAddressMutation } from '../useSubmitMailingAddressMutation'
import { useSubmitConsentMutation } from '../useSubmitConsentMutation'
import { useCardStore } from '../../store'
import { OnboardingPhase, OnboardingStep } from '../../models'
import { getLoginPassword } from '../../store/login-password'

const SCOPES: ChainScope[] = [
    { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
    { chainId: 'ethereum', networkId: 'sepolia' },
]

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

describe.each(SCOPES)('onboarding mutation hooks ($chainId)', SCOPE => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        Object.values(api).forEach(fn => fn.mockResolvedValue(undefined))
        // Token-bearing by default to cover the tolerant finalize path; the
        // null-token answer is set per test.
        api.submitAddress.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'ob_1',
            userId: 'user_1',
        })
        api.submitMailingAddress.mockResolvedValue({
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
            () => useSendEmailVerificationMutation(SCOPE),
            {
                wrapper,
            },
        )
        result.current.mutate({ email: 'e@x.com' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.sendEmailVerification).toHaveBeenCalledWith({
            email: 'e@x.com',
            scope: SCOPE,
        })
        expect(useCardStore.getState().contactVerificationId).toBe('cv_new')
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.EmailVerify,
        )
    })

    it('useVerifyEmailMutation forwards the payload and stores the onboarding id', async () => {
        api.verifyEmail.mockResolvedValue({ onboardingId: 'ob_new' })
        const { result } = renderHook(() => useVerifyEmailMutation(SCOPE), {
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
                scope: SCOPE,
            }),
        )
        expect(useCardStore.getState().onboardingId).toBe('ob_new')
        // Held in memory for the login that creates the session after KYC.
        expect(getLoginPassword()).toBe('pw')
        // email/verify only stores the onboarding id — it doesn't advance the
        // step. The phone/send and phone/verify calls that follow move it on.
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.EmailSend,
        )
    })

    it('useSendPhoneVerificationMutation forwards phone fields', async () => {
        const { result } = renderHook(
            () => useSendPhoneVerificationMutation(SCOPE),
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
                scope: SCOPE,
            }),
        )
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.PhoneVerify,
        )
    })

    it('useVerifyPhoneMutation forwards the code and leaves the step to the router', async () => {
        const { result } = renderHook(() => useVerifyPhoneMutation(SCOPE), {
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
                scope: SCOPE,
            }),
        )
        // The router owns the step once phone verification is done.
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.EmailSend,
        )
    })

    it('useSubmitPersonalDetailsMutation wraps the details with the scope', async () => {
        const details = {
            onboardingId: 'ob_1',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '2000-01-01',
            countryOfNationality: 'GB',
            countryOfBirth: 'GB',
            employmentStatus: 'employed',
            employmentSector: 'informationTechnology',
        }
        api.submitPersonalDetails.mockResolvedValue({
            phase: OnboardingPhase.PhysicalAddress,
        })
        const { result } = renderHook(
            () => useSubmitPersonalDetailsMutation(SCOPE),
            {
                wrapper,
            },
        )
        result.current.mutate(details)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitPersonalDetails).toHaveBeenCalledWith({
            details,
            scope: SCOPE,
        })
        expect(result.current.data).toEqual({
            phase: OnboardingPhase.PhysicalAddress,
        })
    })

    it('useSubmitPersonalDetailsMutation returns the phase Baanx asks for next', async () => {
        api.submitPersonalDetails.mockResolvedValue({
            phase: OnboardingPhase.AdditionalDetails,
        })
        const { result } = renderHook(
            () => useSubmitPersonalDetailsMutation(SCOPE),
            { wrapper },
        )

        result.current.mutate({
            onboardingId: 'ob_1',
            firstName: 'Jane',
            lastName: 'Doe',
            dateOfBirth: '2000-01-01',
            countryOfNationality: 'PT',
            countryOfBirth: 'PT',
            employmentStatus: 'employed',
            employmentSector: 'retail',
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual({
            phase: OnboardingPhase.AdditionalDetails,
        })
    })

    it('useSubmitAdditionalDetailsMutation posts the details and returns the next phase', async () => {
        api.submitAdditionalDetails.mockResolvedValue({
            phase: OnboardingPhase.PhysicalAddress,
        })
        const details = {
            onboardingId: 'ob_1',
            tin: '123456789',
            tinCountry: 'PT',
            occupation: 'it_or_technology_professional',
            sourceOfWealth: 'employment_salaried',
            businessSector: 'information_and_communication',
            estimatedAnnualIncome: '30000',
            incomeCountries: ['PT'],
        }
        const { result } = renderHook(
            () => useSubmitAdditionalDetailsMutation(SCOPE),
            { wrapper },
        )

        result.current.mutate(details)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitAdditionalDetails).toHaveBeenCalledWith({
            details,
            scope: SCOPE,
        })
        expect(result.current.data).toEqual({
            phase: OnboardingPhase.PhysicalAddress,
        })
    })

    it('useSubmitAdditionalDetailsMutation surfaces a failure', async () => {
        api.submitAdditionalDetails.mockRejectedValue({
            response: { status: 503 },
            data: { message: 'Risk standards are unavailable' },
        })
        const { result } = renderHook(
            () => useSubmitAdditionalDetailsMutation(SCOPE),
            { wrapper },
        )

        result.current.mutate({
            onboardingId: 'ob_1',
            tin: '1',
            tinCountry: 'PT',
            occupation: 'x',
            sourceOfWealth: 'y',
            businessSector: 'z',
            estimatedAnnualIncome: '1',
            incomeCountries: ['PT'],
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.data).toBeNull()
    })

    const address = {
        onboardingId: 'ob_1',
        addressLine1: '23 Werrington Bridge Rd',
        city: 'Peterborough',
        zip: 'PE6 7PP',
        isSameMailingAddress: true,
    }

    const mailingAddress = {
        onboardingId: 'ob_1',
        addressLine1: '23 Werrington Bridge Rd',
        city: 'Peterborough',
        zip: 'PE6 7PP',
        usState: 'NY',
    }

    it('useSubmitMailingAddressMutation forwards the scope and completes registration if Baanx sends a token', async () => {
        const { result } = renderHook(
            () => useSubmitMailingAddressMutation(SCOPE),
            { wrapper },
        )
        result.current.mutate(mailingAddress)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitMailingAddress).toHaveBeenCalledWith({
            address: mailingAddress,
            scope: SCOPE,
        })
        expect(auth.acquireCardSessionTokens).toHaveBeenCalledWith({
            accessToken: 'tok',
            scope: SCOPE,
        })
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Completed,
        )
    })

    it('useSubmitAddressMutation exchanges a token Baanx sends for the OAuth pair and completes onboarding', async () => {
        api.submitAddress.mockResolvedValue({
            accessToken: 'tok',
            onboardingId: 'ob_1',
        })
        const { result } = renderHook(() => useSubmitAddressMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitAddress).toHaveBeenCalledWith({
            address,
            scope: SCOPE,
        })
        // The registration-issued token is only used to complete the OAuth
        // flow; the persisted session is the durable access+refresh pair.
        expect(auth.acquireCardSessionTokens).toHaveBeenCalledWith({
            accessToken: 'tok',
            scope: SCOPE,
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
        const { result } = renderHook(() => useSubmitAddressMutation(SCOPE), {
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

    it('useSubmitAddressMutation leaves registration open when no token is issued', async () => {
        // The usual answer: the session comes from the login after KYC.
        useCardStore.getState().setOnboardingStep(OnboardingStep.Address)
        api.submitAddress.mockResolvedValue({
            accessToken: null,
            onboardingId: 'ob_1',
            userId: null,
        })
        const { result } = renderHook(() => useSubmitAddressMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(auth.acquireCardSessionTokens).not.toHaveBeenCalled()
        expect(session.setCardSession).not.toHaveBeenCalled()
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.Address,
        )
    })

    it('useSubmitAddressMutation links the stashed consent once a token names the user', async () => {
        useCardStore.getState().setConsentSetId('cs_1')
        useCardStore.getState().setPassword('pw')
        const { result } = renderHook(() => useSubmitAddressMutation(SCOPE), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.linkOnboardingConsent).toHaveBeenCalledWith({
            consentSetId: 'cs_1',
            userId: 'user_1',
            scope: SCOPE,
        })
        expect(useCardStore.getState().consentSetId).toBeNull()
        expect(useCardStore.getState().cardUserId).toBe('user_1')
        expect(useCardStore.getState().hasPassword).toBe(false)
    })

    it('useSubmitConsentMutation forwards the payload, stashes the consentSetId, and does not advance the step', async () => {
        const stepBefore = useCardStore.getState().onboardingStep
        const { result } = renderHook(() => useSubmitConsentMutation(SCOPE), {
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
                scope: SCOPE,
            }),
        )
        // The created consent set id is stashed for the link step.
        expect(useCardStore.getState().consentSetId).toBe('cs_1')
        // Consent is part of the address step, so it must not advance the
        // onboarding step on its own.
        expect(useCardStore.getState().onboardingStep).toBe(stepBefore)
    })

    it('useSubmitConsentMutation does not overwrite a stashed id when a duplicate returns none', async () => {
        // A duplicate-onboardingId retry resolves with consentSetId: null; the id
        // stashed on the first create must survive for the link step.
        useCardStore.getState().setConsentSetId('cs_first')
        api.submitOnboardingConsent.mockResolvedValue({ consentSetId: null })
        const { result } = renderHook(() => useSubmitConsentMutation(SCOPE), {
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
})
