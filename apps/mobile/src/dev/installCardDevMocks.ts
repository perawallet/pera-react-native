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

// Keyed by `${method} ${path}`. A `null` entry is a 200 with no body (the
// register/* endpoints resolve to void).
const MOCK_RESPONSES: Record<string, unknown> = {
    'GET /v1/auth/settings': REGISTRATION_SETTINGS,
    'POST /v1/auth/register/email/send': null,
}

if (__DEV__) {
    const realTransport = getCardTransport()

    const mockTransport: CardTransport = {
        request<TData, TVars = unknown>(
            req: CardTransportRequest<TVars>,
        ): Promise<CardTransportResponse<TData>> {
            const route = `${req.method} ${req.path}`
            if (route in MOCK_RESPONSES) {
                return Promise.resolve({
                    data: MOCK_RESPONSES[route] as TData,
                    status: 200,
                    statusText: 'OK',
                })
            }
            return realTransport.request<TData, TVars>(req)
        },
    }

    setCardTransport(mockTransport)
}
