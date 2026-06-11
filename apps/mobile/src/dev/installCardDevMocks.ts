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

import {
    getCardTransport,
    setCardTransport,
    type CardTransport,
    type CardTransportRequest,
    type CardTransportResponse,
} from '@perawallet/wallet-core-card'
import { config } from '@perawallet/wallet-core-config'
import { MOCK_VALID_VERIFICATION_CODE } from '@modules/card/screens/cardVerificationConstants'

/**
 * Temporary Baanx mocks until the sandbox is usable. Returns canned data for
 * the endpoints the onboarding email + phone steps need and delegates
 * everything else to the real transport. Imported (for side effects) from
 * App.tsx; runs in development + staging builds and is a no-op in production.
 *
 * Remove once the real Baanx sandbox responds (set `TESTNET_BAANX_CLIENT_KEY`).
 */

// Raw GET /v1/auth/settings shape (camelCase; matches the card package's
// registrationSettingsResponseSchema). One ineligible country exercises the
// canSignUp filter in the picker.
const REGISTRATION_SETTINGS = {
    countries: [
        {
            id: 'gb',
            iso3166alpha2: 'GB',
            name: 'United Kingdom',
            callingCode: '44',
            canSignUp: true,
        },
        {
            id: 'us',
            iso3166alpha2: 'US',
            name: 'United States',
            callingCode: '1',
            canSignUp: true,
        },
        {
            id: 'fr',
            iso3166alpha2: 'FR',
            name: 'France',
            callingCode: '33',
            canSignUp: true,
        },
        {
            id: 'de',
            iso3166alpha2: 'DE',
            name: 'Germany',
            callingCode: '49',
            canSignUp: true,
        },
        {
            id: 'es',
            iso3166alpha2: 'ES',
            name: 'Spain',
            callingCode: '34',
            canSignUp: true,
        },
        {
            id: 'tr',
            iso3166alpha2: 'TR',
            name: 'Türkiye',
            callingCode: '90',
            canSignUp: true,
        },
        {
            id: 'ng',
            iso3166alpha2: 'NG',
            name: 'Nigeria',
            callingCode: '234',
            canSignUp: false,
        },
    ],
    // A few states so the US residential-address path is exercisable.
    usStates: [
        {
            id: 'ca',
            name: 'California',
            postalAbbreviation: 'CA',
            canSignUp: true,
        },
        {
            id: 'ny',
            name: 'New York',
            postalAbbreviation: 'NY',
            canSignUp: true,
        },
        {
            id: 'tx',
            name: 'Texas',
            postalAbbreviation: 'TX',
            canSignUp: true,
        },
    ],
}

type MockResult = { status: number; data: unknown }
// A handler inspects the request (e.g. to validate a code) and returns a status
// + body, mirroring the real endpoint so swapping to the live API is seamless.
type MockHandler = (req: CardTransportRequest<unknown>) => MockResult

const ok = (data: unknown): MockResult => ({ status: 200, data })

// A code-verification endpoint (email/verify, phone/verify): accepts the dev
// code and returns `successData`, otherwise mirrors the real 4xx for a wrong
// code. The verify screens also pre-check the code locally, so a wrong code
// rarely reaches here — but we mirror the real contract anyway.
const verifyCode =
    (successData: unknown): MockHandler =>
    req => {
        const code = (req.data as { verificationCode?: string } | undefined)
            ?.verificationCode
        if (code?.toUpperCase() === MOCK_VALID_VERIFICATION_CODE) {
            return ok(successData)
        }
        return { status: 400, data: { message: 'Invalid verification code' } }
    }

// Keyed by `${method} ${path}`. Handlers mirror the real Baanx responses:
// email/send returns a contactVerificationId; email/verify validates the code
// and returns an onboardingId; phone/send triggers the SMS (empty body) and
// phone/verify validates the code (both endpoints return void on success).
const MOCK_ROUTES: Record<string, MockHandler> = {
    'GET /v1/auth/settings': () => ok(REGISTRATION_SETTINGS),
    'POST /v1/auth/register/email/send': () =>
        ok({ contactVerificationId: 'mock-contact-verification-id' }),
    'POST /v1/auth/register/email/verify': verifyCode({
        onboardingId: 'mock-onboarding-id',
    }),
    'POST /v1/auth/register/phone/send': () => ok({}),
    'POST /v1/auth/register/phone/verify': verifyCode({}),
    'POST /v1/auth/register/personal-details': () => ok({}),
    'POST /v1/auth/register/address': () => ok({}),
}

if (__DEV__ || config.appEnvironment === 'staging') {
    const realTransport = getCardTransport()

    const mockTransport: CardTransport = {
        request<TData, TVars = unknown>(
            req: CardTransportRequest<TVars>,
        ): Promise<CardTransportResponse<TData>> {
            const handler = MOCK_ROUTES[`${req.method} ${req.path}`]
            if (!handler) {
                return realTransport.request<TData, TVars>(req)
            }
            const { status, data } = handler(
                req as CardTransportRequest<unknown>,
            )
            // Mirror the real transport: non-2xx rejects so mutations see `isError`.
            if (status >= 400) {
                return Promise.reject(
                    new Error(
                        `Mock ${req.method} ${req.path} failed (${status})`,
                    ),
                )
            }
            return Promise.resolve({
                data: data as TData,
                status,
                statusText: 'OK',
            })
        },
    }

    setCardTransport(mockTransport)
}
