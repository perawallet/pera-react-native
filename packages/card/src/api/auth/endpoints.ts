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

import type { Network } from '@perawallet/wallet-core-shared'
import { getCardTransport } from '../transport'
import type {
    CardSessionTokens,
    LoginResult,
    OauthAuthorization,
    OauthInitiation,
} from '../../models'
import {
    loginResponseSchema,
    oauthAuthorizeResponseSchema,
    oauthInitiateResponseSchema,
    sendLoginOtpResponseSchema,
    tokenResponseSchema,
} from './schema'
import {
    transformLoginResponse,
    transformOauthAuthorizeResponse,
    transformOauthInitiateResponse,
    transformTokenResponse,
} from './transformers'

export type LoginRequestParams = {
    email: string
    password: string
    otpCode?: string
    network: Network
    signal?: AbortSignal
}

export const loginRequest = async (
    params: LoginRequestParams,
): Promise<LoginResult> => {
    const { email, password, otpCode, network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/login',
        data: { email, password, ...(otpCode ? { otpCode } : {}) },
        signal,
    })

    return transformLoginResponse(loginResponseSchema.parse(response.data))
}

export type SendLoginOtpRequestParams = {
    userId: string
    network: Network
    signal?: AbortSignal
}

/**
 * Asks Baanx to send the login 2FA code (SMS) for a user whose login came back
 * `isOtpRequired`. Baanx does NOT send the code on its own — this call is
 * required before the user can retry login with `otpCode`. Rejects on a 200
 * that reports `success: false` (e.g. send suppressed), so callers can treat
 * "resolved" as "a code is on its way".
 */
export const sendLoginOtpRequest = async (
    params: SendLoginOtpRequestParams,
): Promise<void> => {
    const { userId, network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/login/otp',
        data: { userId },
        signal,
    })

    const { success } = sendLoginOtpResponseSchema.parse(response.data)
    if (success === false) {
        throw new Error('Baanx declined to send the login OTP')
    }
}

export type OauthInitiateRequestParams = {
    /** CSRF token (≥ 8 chars); the authorize step must echo it back. */
    state: string
    /** BASE64URL(SHA256(code_verifier)), method S256. */
    codeChallenge: string
    network: Network
    signal?: AbortSignal
}

/**
 * OAuth step 1, via Pera's backend (`proxy`): the backend pins `client_id` /
 * `redirect_uri` and injects the server-only x-secret-key (initiate is the
 * only Baanx auth endpoint that takes it), then forwards to Baanx's
 * /v1/auth/oauth/authorize/initiate in API mode. Returns the 10-minute
 * session JWT consumed by {@link oauthAuthorizeRequest}.
 */
export const oauthInitiateRequest = async (
    params: OauthInitiateRequestParams,
): Promise<OauthInitiation> => {
    const { state, codeChallenge, network, signal } = params

    const response = await getCardTransport().request({
        route: 'proxy',
        network,
        method: 'GET',
        path: '/api/v3/baanx/oauth/initiate',
        params: { state, code_challenge: codeChallenge },
        signal,
    })

    return transformOauthInitiateResponse(
        oauthInitiateResponseSchema.parse(response.data),
    )
}

export type OauthAuthorizeRequestParams = {
    /** Session JWT from {@link oauthInitiateRequest}. */
    sessionToken: string
    /** Ephemeral access token from {@link loginRequest} (OAuth step 2). */
    accessToken: string
    network: Network
    signal?: AbortSignal
}

/**
 * OAuth step 3, direct to Baanx: trades the initiate JWT + the ephemeral login
 * Bearer for a single-use authorization code. The Bearer is passed explicitly
 * (NOT via `authenticated`) — the keystore holds no session yet, and a prior
 * session's token must not leak in.
 */
export const oauthAuthorizeRequest = async (
    params: OauthAuthorizeRequestParams,
): Promise<OauthAuthorization> => {
    const { sessionToken, accessToken, network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/oauth/authorize',
        data: { token: sessionToken },
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
    })

    return transformOauthAuthorizeResponse(
        oauthAuthorizeResponseSchema.parse(response.data),
    )
}

export type OauthTokenRequestParams = {
    /** Single-use authorization code from {@link oauthAuthorizeRequest}. */
    code: string
    /** The original PKCE verifier whose challenge was sent to initiate. */
    codeVerifier: string
    network: Network
    signal?: AbortSignal
}

/**
 * OAuth step 4, via Pera's backend (`proxy`): the backend pins `redirect_uri`
 * (its token schema accepts only `code` + `code_verifier`) and forwards the
 * authorization-code grant to Baanx. Returns the durable 6h access / 7-day
 * refresh pair.
 */
export const oauthTokenRequest = async (
    params: OauthTokenRequestParams,
): Promise<CardSessionTokens> => {
    const { code, codeVerifier, network, signal } = params

    const response = await getCardTransport().request({
        route: 'proxy',
        network,
        method: 'POST',
        path: '/api/v3/baanx/oauth/token',
        data: { code, code_verifier: codeVerifier },
        signal,
    })

    return transformTokenResponse(tokenResponseSchema.parse(response.data))
}

export type RefreshTokenRequestParams = {
    refreshToken: string
    network: Network
    signal?: AbortSignal
}

/**
 * Exchanges the refresh token for a fresh token pair, direct to Baanx: the
 * refresh grant authenticates with the x-client-key alone (Pera's backend
 * proxy accepts only the authorization-code grant, and Baanx rejects extra
 * client auth on this endpoint). Never marked `authenticated` — a 401 from an
 * expired refresh token must surface instead of re-entering the transport's
 * refresh handler.
 */
export const refreshTokenRequest = async (
    params: RefreshTokenRequestParams,
): Promise<CardSessionTokens> => {
    const { refreshToken, network, signal } = params

    const response = await getCardTransport().request({
        network,
        method: 'POST',
        path: '/v1/auth/oauth/token',
        data: { grant_type: 'refresh_token', refresh_token: refreshToken },
        signal,
    })

    return transformTokenResponse(tokenResponseSchema.parse(response.data))
}
