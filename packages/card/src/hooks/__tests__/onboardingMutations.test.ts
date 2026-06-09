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

const api = vi.hoisted(() => ({
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
    sendPhoneVerification: vi.fn(),
    verifyPhone: vi.fn(),
    submitPersonalDetails: vi.fn(),
    submitAddress: vi.fn(),
}))
vi.mock('../../api/onboarding', () => api)

import { useSendEmailVerificationMutation } from '../useSendEmailVerificationMutation'
import { useVerifyEmailMutation } from '../useVerifyEmailMutation'
import { useSendPhoneVerificationMutation } from '../useSendPhoneVerificationMutation'
import { useVerifyPhoneMutation } from '../useVerifyPhoneMutation'
import { useSubmitPersonalDetailsMutation } from '../useSubmitPersonalDetailsMutation'
import { useSubmitAddressMutation } from '../useSubmitAddressMutation'
import { useCardStore } from '../../store'
import { OnboardingStep } from '../../models'

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
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.verifyEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                verificationCode: '123456',
                contactVerificationId: 'cv_1',
                network: 'mainnet',
            }),
        )
        expect(useCardStore.getState().onboardingId).toBe('ob_new')
        expect(useCardStore.getState().onboardingStep).toBe(
            OnboardingStep.PhoneSend,
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
    })

    it('useVerifyPhoneMutation forwards onboardingId + code', async () => {
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
    })

    it('useSubmitAddressMutation wraps the address with the network', async () => {
        const address = {
            onboardingId: 'ob_1',
            addressLine1: '23 Werrington Bridge Rd',
            city: 'Peterborough',
            zip: 'PE6 7PP',
            isSameMailingAddress: true,
        }
        const { result } = renderHook(() => useSubmitAddressMutation(), {
            wrapper,
        })
        result.current.mutate(address)

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(api.submitAddress).toHaveBeenCalledWith({
            address,
            network: 'mainnet',
        })
    })
})
