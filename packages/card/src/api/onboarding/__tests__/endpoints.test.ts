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
    submitOnboardingConsent,
    linkOnboardingConsent,
    fetchRegistrationSettings,
    buildOnboardingConsentBody,
} from '../endpoints'
import { VerificationState } from '../../../models'

describe('buildOnboardingConsentBody', () => {
    const base = {
        onboardingId: 'ob_1',
        tenantId: 'tenant_1',
        termsAccepted: true,
    }

    it('builds the global policy consents (no eSignAct) with everything granted', () => {
        const body = buildOnboardingConsentBody({
            ...base,
            policyType: 'global',
            allowMarketing: true,
            allowSms: true,
        })

        expect(body).toEqual({
            onboardingId: 'ob_1',
            tenantId: 'tenant_1',
            policyType: 'global',
            consents: [
                { consentType: 'termsAndPrivacy', consentStatus: 'granted' },
                {
                    consentType: 'marketingNotifications',
                    consentStatus: 'granted',
                },
                { consentType: 'smsNotifications', consentStatus: 'granted' },
                { consentType: 'emailNotifications', consentStatus: 'granted' },
            ],
        })
    })

    it('maps the SMS consent independently of marketing', () => {
        // Marketing off but SMS on: only smsNotifications is granted among the
        // notification channels (marketing + email follow allowMarketing).
        const body = buildOnboardingConsentBody({
            ...base,
            policyType: 'global',
            allowMarketing: false,
            allowSms: true,
        })

        const byType = Object.fromEntries(
            body.consents.map(consent => [
                consent.consentType,
                consent.consentStatus,
            ]),
        )
        expect(byType.marketingNotifications).toBe('denied')
        expect(byType.emailNotifications).toBe('denied')
        expect(byType.smsNotifications).toBe('granted')
        expect(byType.termsAndPrivacy).toBe('granted')
    })

    it('adds the eSignAct consent for the US policy', () => {
        const body = buildOnboardingConsentBody({
            ...base,
            policyType: 'US',
            allowMarketing: false,
            allowSms: false,
        })

        expect(body.consents).toContainEqual({
            consentType: 'eSignAct',
            consentStatus: 'granted',
        })
        expect(body.consents).toHaveLength(5)
    })
})

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
            allowMarketing: true,
            allowSms: false,
            network: 'mainnet',
        })

        expect(result).toEqual({ onboardingId: 'ob_1', hasAccount: false })
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
                // Baanx requires both consent flags on this call.
                allowMarketing: true,
                allowSms: false,
            }),
        )
        // network/signal must not leak into the request body
        expect(body).not.toHaveProperty('network')
        expect(body).not.toHaveProperty('signal')
    })

    it('flags an already-registered email (hasAccount, no onboarding id)', async () => {
        // Baanx answers 200 with this shape when the email already has an
        // account — it must parse (not throw) so the caller can route to sign-in.
        request.mockResolvedValue({
            data: { hasAccount: true, onboardingId: null, user: null },
        })

        const result = await verifyEmail({
            email: 'e@x.com',
            password: 'pw',
            verificationCode: '123456',
            contactVerificationId: 'cv_1',
            countryOfResidence: 'GB',
            allowMarketing: true,
            allowSms: false,
            network: 'mainnet',
        })

        expect(result).toEqual({ onboardingId: null, hasAccount: true })
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

    it('returns null for an unmodelled verification state', async () => {
        request.mockResolvedValue({
            data: { verificationState: 'SOMETHING_NEW' },
        })

        const result = await fetchOnboardingDetails({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        // Never coerce an unknown state to UNVERIFIED: consumers would treat a
        // progressing user as needing a fresh Veriff session.
        expect(result.verificationState).toBeNull()
    })

    it('returns null when the verification state is absent', async () => {
        // The schema is nullish, so a missing/null state resolves to null
        // rather than throwing the whole poll.
        request.mockResolvedValue({ data: { id: 'ob_1' } })

        const result = await fetchOnboardingDetails({
            onboardingId: 'ob_1',
            network: 'mainnet',
        })

        expect(result.verificationState).toBeNull()
    })

    it('submits address and returns the access token, onboarding id, and user id', async () => {
        request.mockResolvedValue({
            data: {
                accessToken: 'tok',
                onboardingId: 'ob_1',
                user: { id: 'user_1' },
            },
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

        expect(result).toEqual({
            accessToken: 'tok',
            onboardingId: 'ob_1',
            userId: 'user_1',
        })
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

    it('returns a null userId when the address response omits the user block', async () => {
        request.mockResolvedValue({
            data: { accessToken: 'tok', onboardingId: 'ob_1' },
        })

        const result = await submitAddress({
            address: {
                onboardingId: 'ob_1',
                addressLine1: '1 A St',
                city: 'Town',
                zip: 'Z1',
                isSameMailingAddress: true,
            },
            network: 'mainnet',
        })

        expect(result.userId).toBeNull()
    })

    it('posts the consent set to /v2/consent/onboarding and returns the consentSetId', async () => {
        request.mockResolvedValue({ data: { consentSetId: 'cs_1' } })

        const result = await submitOnboardingConsent({
            onboardingId: 'ob_1',
            policyType: 'global',
            termsAccepted: true,
            allowMarketing: false,
            network: 'mainnet',
        })

        expect(result).toEqual({ consentSetId: 'cs_1' })
        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                path: '/v2/consent/onboarding',
                data: expect.objectContaining({ onboardingId: 'ob_1' }),
            }),
        )
    })

    it('returns a null consentSetId when the consent response shape is unexpected', async () => {
        request.mockResolvedValue({ data: { success: true } })

        const result = await submitOnboardingConsent({
            onboardingId: 'ob_1',
            policyType: 'global',
            termsAccepted: true,
            allowMarketing: false,
            network: 'mainnet',
        })

        expect(result).toEqual({ consentSetId: null })
    })

    it('treats a duplicate-onboardingId consent error as success (no id to return)', async () => {
        // Baanx rejects a re-submitted consent set (e.g. after the address step
        // failed and the user retries). The consent already exists, so this must
        // resolve; the link step falls back to the id stashed on the first create.
        request.mockRejectedValue({
            data: {
                message: JSON.stringify({
                    error: 'Duplicate onboardingId',
                    details: [
                        "A consent set with onboardingId 'ob_1' already exists",
                    ],
                }),
            },
        })

        await expect(
            submitOnboardingConsent({
                onboardingId: 'ob_1',
                policyType: 'global',
                termsAccepted: true,
                allowMarketing: false,
                network: 'mainnet',
            }),
        ).resolves.toEqual({ consentSetId: null })
    })

    it('rethrows a non-duplicate consent failure', async () => {
        const failure = { response: { status: 500 }, data: { message: 'boom' } }
        request.mockRejectedValue(failure)

        await expect(
            submitOnboardingConsent({
                onboardingId: 'ob_1',
                policyType: 'global',
                termsAccepted: true,
                allowMarketing: false,
                network: 'mainnet',
            }),
        ).rejects.toBe(failure)
    })

    it('links the consent set to the user via PATCH', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await linkOnboardingConsent({
            consentSetId: 'cs_1',
            userId: 'user_1',
            network: 'mainnet',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'PATCH',
                path: '/v2/consent/onboarding/cs_1',
                data: { userId: 'user_1' },
            }),
        )
    })

    it('treats an already-linked (409 Conflict) consent link as success', async () => {
        // Linking a set that is already bound returns 409; the desired end state
        // is reached, so this must resolve rather than throw.
        request.mockRejectedValue({ response: { status: 409 } })

        await expect(
            linkOnboardingConsent({
                consentSetId: 'cs_1',
                userId: 'user_1',
                network: 'mainnet',
            }),
        ).resolves.toBeUndefined()
    })

    it('rethrows a non-conflict consent link failure', async () => {
        const failure = { response: { status: 500 }, data: { message: 'boom' } }
        request.mockRejectedValue(failure)

        await expect(
            linkOnboardingConsent({
                consentSetId: 'cs_1',
                userId: 'user_1',
                network: 'mainnet',
            }),
        ).rejects.toBe(failure)
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
