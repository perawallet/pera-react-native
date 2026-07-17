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

import { logger, type Network } from '@perawallet/wallet-core-shared'
import type { CardSessionTokens } from '../../models'
import {
    oauthAuthorizeRequest,
    oauthInitiateRequest,
    oauthTokenRequest,
} from './endpoints'
import { createOauthState, createPkcePair } from './pkce'

/** The authorize step echoed a different `state` than we sent — possible CSRF. */
export class OauthStateMismatchError extends Error {
    constructor() {
        super('Baanx OAuth state mismatch')
        this.name = 'OauthStateMismatchError'
    }
}

export type ExchangeLoginForOauthTokensParams = {
    /** Ephemeral access token from a successful `loginRequest` (OAuth step 2). */
    accessToken: string
    network: Network
    signal?: AbortSignal
}

/**
 * Completes the OAuth 2.0 authorization-code + PKCE flow (API mode) after a
 * successful credential login: initiate (proxied, pinned client) → authorize
 * (direct, login Bearer) → code-for-tokens exchange (proxied). Fresh PKCE and
 * `state` material is generated per attempt; the initiate session JWT lives
 * 10 minutes, far beyond this immediate chain. Returns the durable 6h access /
 * 7-day refresh pair to persist.
 */
export const exchangeLoginForOauthTokens = async (
    params: ExchangeLoginForOauthTokensParams,
): Promise<CardSessionTokens> => {
    const { accessToken, network, signal } = params

    const { codeVerifier, codeChallenge } = createPkcePair()
    const state = createOauthState()

    const { sessionToken } = await oauthInitiateRequest({
        state,
        codeChallenge,
        network,
        signal,
    })

    const authorization = await oauthAuthorizeRequest({
        sessionToken,
        accessToken,
        network,
        signal,
    })

    if (authorization.state !== state) {
        throw new OauthStateMismatchError()
    }

    return oauthTokenRequest({
        code: authorization.code,
        codeVerifier,
        network,
        signal,
    })
}

/**
 * Runs the OAuth exchange and, if any step fails, falls back to a session
 * built from the ephemeral access token alone (no refresh token — the same
 * shape direct login produced before OAuth). The credentials were already
 * accepted at this point, so an OAuth-proxy outage must degrade the session
 * (re-login at the 6h expiry) rather than fail the whole login/registration.
 * The failure — including a state mismatch, a possible CSRF signal — is
 * logged for diagnosis; the fallback token itself never transited a
 * redirect, so using it is no worse than the pre-OAuth flow.
 */
export const acquireCardSessionTokens = async (
    params: ExchangeLoginForOauthTokensParams,
): Promise<CardSessionTokens> => {
    try {
        return await exchangeLoginForOauthTokens(params)
    } catch (error) {
        logger.warn(
            'Baanx OAuth exchange failed; falling back to an access-token-only session',
            { error },
        )
        return { accessToken: params.accessToken, refreshToken: '' }
    }
}
