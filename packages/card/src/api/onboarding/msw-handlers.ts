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

import { http, HttpResponse, type HttpHandler } from 'msw'
import { validateMockResponse } from '@perawallet/wallet-core-shared/test-utils'
import {
    addressResponseSchema,
    connectFundingSourceResponseSchema,
    consentResponseSchema,
    onboardingDetailsResponseSchema,
    registerVerificationResponseSchema,
    registrationSettingsResponseSchema,
    type AddressApiResponse,
    type ConnectFundingSourceApiResponse,
    type ConsentApiResponse,
    type OnboardingDetailsApiResponse,
    type RegisterVerificationApiResponse,
    type RegistrationSettingsApiResponse,
} from './schema'

const successPost = (path: string): HttpHandler =>
    http.post(path, () => HttpResponse.json({ success: true }))

export const mockSendEmailVerification = (): HttpHandler =>
    successPost('*/v1/auth/register/email/send')
export const mockVerifyEmail = (): HttpHandler =>
    successPost('*/v1/auth/register/email/verify')
export const mockSendPhoneVerification = (): HttpHandler =>
    successPost('*/v1/auth/register/phone/send')
export const mockVerifyPhone = (): HttpHandler =>
    successPost('*/v1/auth/register/phone/verify')
export const mockSubmitPersonalDetails = (): HttpHandler =>
    successPost('*/v1/auth/register/personal-details')

// Consent create (step 1) returns the consent set id the link step binds; the
// body is zod-parsed leniently, so the mock returns a realistic id by default.
export type MockSubmitOnboardingConsentParams = {
    response?: ConsentApiResponse
    status?: number
}
export const mockSubmitOnboardingConsent = ({
    response = { consentSetId: 'mock-consent-set-id' },
    status = 200,
}: MockSubmitOnboardingConsentParams = {}): HttpHandler => {
    validateMockResponse(
        consentResponseSchema,
        response,
        'mockSubmitOnboardingConsent',
    )
    return http.post('*/v2/consent/onboarding', () =>
        HttpResponse.json(response, { status }),
    )
}

// Consent link (step 2): PATCH /v2/consent/onboarding/{consentSetId}. No body of
// our own is consumed, so default to a generic success.
export type MockLinkOnboardingConsentParams = { status?: number }
export const mockLinkOnboardingConsent = ({
    status = 200,
}: MockLinkOnboardingConsentParams = {}): HttpHandler =>
    http.patch('*/v2/consent/onboarding/*', () =>
        HttpResponse.json({ success: true }, { status }),
    )

// Onboarding KYC: pre-auth start (returns the Veriff session URL) + the status
// poll the verification screen watches.
export type MockStartRegisterVerificationParams = {
    response?: RegisterVerificationApiResponse
    status?: number
}
export const mockStartRegisterVerification = ({
    response = { sessionUrl: 'https://veriff.example/session' },
    status = 200,
}: MockStartRegisterVerificationParams = {}): HttpHandler => {
    validateMockResponse(
        registerVerificationResponseSchema,
        response,
        'mockStartRegisterVerification',
    )
    return http.post('*/v1/auth/register/verification', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetOnboardingDetailsParams = {
    response: OnboardingDetailsApiResponse
    status?: number
}
export const mockGetOnboardingDetails = ({
    response,
    status = 200,
}: MockGetOnboardingDetailsParams): HttpHandler => {
    validateMockResponse(
        onboardingDetailsResponseSchema,
        response,
        'mockGetOnboardingDetails',
    )
    // GET-only, so this can't shadow the POST register/* routes.
    return http.get('*/v1/auth/register', () =>
        HttpResponse.json(response, { status }),
    )
}

// The address step returns the access token the verification step needs, so the
// mock returns a token-bearing body by default (overridable per test).
export type MockSubmitAddressParams = {
    response?: AddressApiResponse
    status?: number
}
export const mockSubmitAddress = ({
    response = {
        accessToken: 'mock-access-token',
        onboardingId: 'mock-onboarding-id',
        user: { id: 'mock-user-id' },
    },
    status = 200,
}: MockSubmitAddressParams = {}): HttpHandler => {
    validateMockResponse(addressResponseSchema, response, 'mockSubmitAddress')
    return http.post('*/v1/auth/register/address', () =>
        HttpResponse.json(response, { status }),
    )
}

// Connect Funds: the response is zod-parsed (we need the id), so the mock must
// return a `{ fundingSourceId }` body — not the generic `{ success: true }`.
export type MockConnectFundingSourceParams = {
    response?: ConnectFundingSourceApiResponse
    status?: number
}
export const mockConnectFundingSource = ({
    response = { fundingSourceId: 'mock-funding-source-id' },
    status = 200,
}: MockConnectFundingSourceParams = {}): HttpHandler => {
    validateMockResponse(
        connectFundingSourceResponseSchema,
        response,
        'mockConnectFundingSource',
    )
    return http.post('*/v1/card/funding-source', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockGetRegistrationSettingsParams = {
    response: RegistrationSettingsApiResponse
    status?: number
}
export const mockGetRegistrationSettings = ({
    response,
    status = 200,
}: MockGetRegistrationSettingsParams): HttpHandler => {
    validateMockResponse(
        registrationSettingsResponseSchema,
        response,
        'mockGetRegistrationSettings',
    )
    return http.get('*/v1/auth/settings', () =>
        HttpResponse.json(response, { status }),
    )
}
