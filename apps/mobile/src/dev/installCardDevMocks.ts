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
import { MOCK_VALID_VERIFICATION_CODE } from '@modules/card/screens/CardOnboardingEmailVerifyScreen/useCardOnboardingEmailVerifyScreen'

/**
 * Temporary dev-only Baanx mocks until sandbox credentials arrive. Returns
 * canned data for the endpoints the onboarding email step needs and delegates
 * everything else to the real transport. Imported (for side effects) from
 * App.tsx; the `__DEV__` guard makes it a no-op in production.
 *
 * Remove once `TESTNET_BAANX_CLIENT_KEY` is wired up.
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
    usStates: [],
}

type MockResult = { status: number; data: unknown }
// A handler inspects the request (e.g. to validate a code) and returns a status
// + body, mirroring the real endpoint so swapping to the live API is seamless.
type MockHandler = (req: CardTransportRequest<unknown>) => MockResult

const ok = (data: unknown): MockResult => ({ status: 200, data })

// Keyed by `${method} ${path}`. Handlers mirror the real Baanx responses:
// email/send returns a contactVerificationId; email/verify validates the code
// and returns an onboardingId (or a 4xx for a wrong code).
const MOCK_ROUTES: Record<string, MockHandler> = {
    'GET /v1/auth/settings': () => ok(REGISTRATION_SETTINGS),
    'POST /v1/auth/register/email/send': () =>
        ok({ contactVerificationId: 'mock-contact-verification-id' }),
    'POST /v1/auth/register/email/verify': req => {
        const code = (req.data as { verificationCode?: string } | undefined)
            ?.verificationCode
        if (code?.toUpperCase() === MOCK_VALID_VERIFICATION_CODE) {
            return ok({ onboardingId: 'mock-onboarding-id' })
        }
        return { status: 400, data: { message: 'Invalid verification code' } }
    },
}

if (__DEV__) {
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
