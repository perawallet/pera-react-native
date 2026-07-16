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
    loginResponseSchema,
    oauthAuthorizeResponseSchema,
    oauthInitiateResponseSchema,
    sendLoginOtpResponseSchema,
    tokenResponseSchema,
    type LoginApiResponse,
    type OauthAuthorizeApiResponse,
    type OauthInitiateApiResponse,
    type SendLoginOtpApiResponse,
    type TokenApiResponse,
} from './schema'

export type MockLoginParams = {
    response: LoginApiResponse
    status?: number
}

export const mockLogin = ({
    response,
    status = 200,
}: MockLoginParams): HttpHandler => {
    validateMockResponse(loginResponseSchema, response, 'mockLogin')
    return http.post('*/v1/auth/login', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockSendLoginOtpParams = {
    response?: SendLoginOtpApiResponse
    status?: number
}

export const mockSendLoginOtp = ({
    response = { success: true },
    status = 200,
}: MockSendLoginOtpParams = {}): HttpHandler => {
    validateMockResponse(
        sendLoginOtpResponseSchema,
        response,
        'mockSendLoginOtp',
    )
    return http.post('*/v1/auth/login/otp', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockOauthInitiateParams = {
    response: OauthInitiateApiResponse
    status?: number
}

// Matches the Pera-backend proxy path (/api/v3/baanx/oauth/initiate).
export const mockOauthInitiate = ({
    response,
    status = 200,
}: MockOauthInitiateParams): HttpHandler => {
    validateMockResponse(
        oauthInitiateResponseSchema,
        response,
        'mockOauthInitiate',
    )
    return http.get('*/baanx/oauth/initiate', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockOauthAuthorizeParams = {
    response: OauthAuthorizeApiResponse
    status?: number
}

export const mockOauthAuthorize = ({
    response,
    status = 200,
}: MockOauthAuthorizeParams): HttpHandler => {
    validateMockResponse(
        oauthAuthorizeResponseSchema,
        response,
        'mockOauthAuthorize',
    )
    return http.post('*/v1/auth/oauth/authorize', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockOauthTokenParams = {
    response: TokenApiResponse
    status?: number
}

// Matches the Pera-backend proxy path (/api/v3/baanx/oauth/token) — the
// authorization-code exchange. The refresh grant hits Baanx directly at
// /v1/auth/oauth/token; use mockRefreshToken for that.
export const mockOauthToken = ({
    response,
    status = 200,
}: MockOauthTokenParams): HttpHandler => {
    validateMockResponse(tokenResponseSchema, response, 'mockOauthToken')
    return http.post('*/baanx/oauth/token', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockRefreshTokenParams = {
    response: TokenApiResponse
    status?: number
}

export const mockRefreshToken = ({
    response,
    status = 200,
}: MockRefreshTokenParams): HttpHandler => {
    validateMockResponse(tokenResponseSchema, response, 'mockRefreshToken')
    return http.post('*/v1/auth/oauth/token', () =>
        HttpResponse.json(response, { status }),
    )
}

export type MockOauthChainParams = {
    /** Token payload returned by the final exchange step. */
    tokenResponse?: TokenApiResponse
    /** Authorization code the authorize step hands back. */
    code?: string
}

/**
 * Stubs the whole happy-path OAuth chain — initiate (Pera proxy) → authorize
 * (direct) → code exchange (Pera proxy) — with the CSRF `state` captured from
 * initiate and echoed by authorize, as Baanx does. Use the individual
 * factories above for error-path stubbing; this is the one-call happy path.
 */
export const mockOauthChain = ({
    tokenResponse = {
        access_token: 'oauth-access-token',
        expires_in: 21_600,
        refresh_token: 'oauth-refresh-token',
        refresh_token_expires_in: 604_800,
    },
    code = 'auth-code-1',
}: MockOauthChainParams = {}): HttpHandler[] => {
    validateMockResponse(tokenResponseSchema, tokenResponse, 'mockOauthChain')
    let capturedState: string | null = null
    return [
        http.get('*/baanx/oauth/initiate', ({ request }) => {
            capturedState = new URL(request.url).searchParams.get('state')
            return HttpResponse.json(
                { token: 'oauth-session-jwt' },
                { status: 200 },
            )
        }),
        http.post('*/v1/auth/oauth/authorize', () =>
            HttpResponse.json(
                { code, state: capturedState },
                { status: 200 },
            ),
        ),
        http.post('*/baanx/oauth/token', () =>
            HttpResponse.json(tokenResponse, { status: 200 }),
        ),
    ]
}
