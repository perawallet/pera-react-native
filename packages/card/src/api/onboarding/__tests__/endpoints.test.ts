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

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    sendEmailVerification,
    verifyEmail,
    sendPhoneVerification,
    verifyPhone,
    startRegisterVerification,
    fetchOnboardingDetails,
    submitAddress,
    fetchRegistrationSettings,
} from '../endpoints'
import { VerificationState } from '../../../models'

describe('onboarding endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('sends the email verification code and returns the contact verification id', async () => {
        request.mockResolvedValue({ data: { contactVerificationId: 'cv_1' } })

        const result = await sendEmailVerification({
            email: 'e@x.com',
            network: 'mainnet',
        })

        expect(result).toEqual({ contactVerificationId: 'cv_1' })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/register/email/send',
                data: { email: 'e@x.com' },
            }),
        )
    })

    it('verifies email with verificationCode + password + contactVerificationId and returns the onboarding id', async () => {
        request.mockResolvedValue({ data: { onboardingId: 'ob_1' } })

        const result = await verifyEmail({
            email: 'e@x.com',
            password: 'pw',
            verificationCode: '123456',
            contactVerificationId: 'cv_1',
            countryOfResidence: 'GB',
            network: 'mainnet',
        })

        expect(result).toEqual({ onboardingId: 'ob_1' })
        const body = request.mock.calls[0][0].data
        expect(request.mock.calls[0][0].path).toBe(
            '/v1/auth/register/email/verify',
        )
        expect(body).toEqual(
            expect.objectContaining({
                email: 'e@x.com',
                password: 'pw',
                verificationCode: '123456',
                contactVerificationId: 'cv_1',
                countryOfResidence: 'GB',
            }),
        )
        // network/signal must not leak into the request body
        expect(body).not.toHaveProperty('network')
        expect(body).not.toHaveProperty('signal')
    })

    it('sends the phone code with phoneNumber + phoneCountryCode + contactVerificationId', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await sendPhoneVerification({
            phoneCountryCode: '+44',
            phoneNumber: '7400846282',
            contactVerificationId: 'cv_1',
            network: 'mainnet',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/v1/auth/register/phone/send',
                data: {
                    phoneCountryCode: '+44',
                    phoneNumber: '7400846282',
                    contactVerificationId: 'cv_1',
                },
            }),
        )
    })

    it('verifies phone with onboardingId + verificationCode', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await verifyPhone({
            onboardingId: 'ob_1',
            phoneCountryCode: '+44',
            phoneNumber: '7400846282',
            contactVerificationId: 'cv_1',
            verificationCode: '654321',
            network: 'mainnet',
        })

        const body = request.mock.calls[0][0].data
        expect(body).toEqual(
            expect.objectContaining({
                onboardingId: 'ob_1',
                verificationCode: '654321',
            }),
        )
    })

    it('starts onboarding KYC with the onboarding id and returns the session url', async () => {
        request.mockResolvedValue({
            data: { sessionUrl: 'https://veriff/session' },
        })

        const result = await startRegisterVerification({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        expect(result).toEqual({ sessionUrl: 'https://veriff/session' })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/register/verification',
                data: { onboardingId: 'ob_1' },
            }),
        )
    })

    it('fetches onboarding details and maps the verification state', async () => {
        request.mockResolvedValue({
            data: { id: 'ob_1', verificationState: 'PENDING' },
        })

        const result = await fetchOnboardingDetails({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        // Profile fields are null when the record has none yet.
        expect(result).toEqual({
            verificationState: VerificationState.Pending,
            firstName: null,
            lastName: null,
            dateOfBirth: null,
            countryOfNationality: null,
        })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/auth/register',
                params: { onboardingId: 'ob_1' },
            }),
        )
    })

    it('passes through the profile fields used to prefill the form', async () => {
        request.mockResolvedValue({
            data: {
                id: 'ob_1',
                verificationState: 'VERIFIED',
                firstName: 'YASIN',
                lastName: 'ÇALIŞKAN',
                dateOfBirth: '1997-11-08T00:00:00.000Z',
                countryOfNationality: null,
            },
        })

        const result = await fetchOnboardingDetails({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        expect(result).toEqual({
            verificationState: VerificationState.Verified,
            firstName: 'YASIN',
            lastName: 'ÇALIŞKAN',
            dateOfBirth: '1997-11-08T00:00:00.000Z',
            countryOfNationality: null,
        })
    })

    it('falls back to UNVERIFIED for an unknown verification state', async () => {
        request.mockResolvedValue({
            data: { verificationState: 'SOMETHING_NEW' },
        })

        const result = await fetchOnboardingDetails({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        expect(result.verificationState).toBe(VerificationState.Unverified)
    })

    it('submits address and returns the issued access token + onboarding id', async () => {
        request.mockResolvedValue({
            data: { accessToken: 'tok', onboardingId: 'ob_1' },
        })

        const result = await submitAddress({
            address: {
                onboardingId: 'ob_1',
                addressLine1: '23 Werrington Bridge Rd',
                city: 'Peterborough',
                zip: 'PE6 7PP',
                isSameMailingAddress: true,
            },
            network: 'mainnet',
        })

        expect(result).toEqual({ accessToken: 'tok', onboardingId: 'ob_1' })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                path: '/v1/auth/register/address',
                data: expect.objectContaining({
                    onboardingId: 'ob_1',
                    isSameMailingAddress: true,
                }),
            }),
        )
    })

    it('fetches and maps registration settings, including the T&C links', async () => {
        request.mockResolvedValue({
            data: {
                countries: [
                    {
                        id: 'c1',
                        iso3166alpha2: 'GB',
                        name: 'United Kingdom',
                        callingCode: '44',
                        canSignUp: true,
                    },
                ],
                usStates: [],
                links: {
                    us: { termsAndConditions: 'https://baanx/us-terms.pdf' },
                    intl: {
                        termsAndConditions: 'https://baanx/intl-terms.pdf',
                    },
                },
            },
        })

        const settings = await fetchRegistrationSettings({ network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                path: '/v1/auth/settings',
            }),
        )
        expect(settings.countries[0].name).toBe('United Kingdom')
        expect(settings.termsAndConditionsUrls.intl).toBe(
            'https://baanx/intl-terms.pdf',
        )
    })
})
