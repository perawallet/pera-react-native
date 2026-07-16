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

const { oauthInitiateRequest, oauthAuthorizeRequest, oauthTokenRequest } =
    vi.hoisted(() => ({
        oauthInitiateRequest: vi.fn(),
        oauthAuthorizeRequest: vi.fn(),
        oauthTokenRequest: vi.fn(),
    }))
vi.mock('../endpoints', () => ({
    oauthInitiateRequest,
    oauthAuthorizeRequest,
    oauthTokenRequest,
}))

import {
    acquireCardSessionTokens,
    exchangeLoginForOauthTokens,
    OauthStateMismatchError,
} from '../oauth-login'
import { createCodeChallenge } from '../pkce'

describe('exchangeLoginForOauthTokens', () => {
    beforeEach(() => vi.clearAllMocks())

    it('chains initiate → authorize → token with consistent PKCE material', async () => {
        oauthInitiateRequest.mockResolvedValue({ sessionToken: 'jwt-session' })
        // Echo back whatever state the flow generated, as Baanx would.
        oauthAuthorizeRequest.mockImplementation(async () => ({
            code: 'auth-code',
            state: oauthInitiateRequest.mock.calls[0][0].state,
        }))
        oauthTokenRequest.mockResolvedValue({
            accessToken: 'x',
            refreshToken: 'y',
        })

        const tokens = await exchangeLoginForOauthTokens({
            accessToken: 'login-token',
            network: 'mainnet',
        })

        const initiateArgs = oauthInitiateRequest.mock.calls[0][0]
        expect(initiateArgs.state).toMatch(/^[A-Za-z0-9_-]{8,}$/)

        expect(oauthAuthorizeRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionToken: 'jwt-session',
                accessToken: 'login-token',
                network: 'mainnet',
            }),
        )

        // The verifier sent to the token exchange must hash to the challenge
        // sent to initiate — otherwise Baanx's S256 check rejects the code.
        const tokenArgs = oauthTokenRequest.mock.calls[0][0]
        expect(tokenArgs.code).toBe('auth-code')
        expect(createCodeChallenge(tokenArgs.codeVerifier)).toBe(
            initiateArgs.codeChallenge,
        )

        expect(tokens).toEqual({ accessToken: 'x', refreshToken: 'y' })
    })

    it('rejects on a state mismatch without exchanging the code', async () => {
        oauthInitiateRequest.mockResolvedValue({ sessionToken: 'jwt-session' })
        oauthAuthorizeRequest.mockResolvedValue({
            code: 'auth-code',
            state: 'tampered-state',
        })

        await expect(
            exchangeLoginForOauthTokens({
                accessToken: 'login-token',
                network: 'mainnet',
            }),
        ).rejects.toBeInstanceOf(OauthStateMismatchError)
        expect(oauthTokenRequest).not.toHaveBeenCalled()
    })

    it('acquireCardSessionTokens returns the exchanged pair on success', async () => {
        oauthInitiateRequest.mockResolvedValue({ sessionToken: 'jwt-session' })
        oauthAuthorizeRequest.mockImplementation(async () => ({
            code: 'auth-code',
            state: oauthInitiateRequest.mock.calls[0][0].state,
        }))
        oauthTokenRequest.mockResolvedValue({
            accessToken: 'x',
            refreshToken: 'y',
        })

        await expect(
            acquireCardSessionTokens({
                accessToken: 'login-token',
                network: 'mainnet',
            }),
        ).resolves.toEqual({ accessToken: 'x', refreshToken: 'y' })
    })

    it('acquireCardSessionTokens falls back to a refresh-less pair when the exchange fails', async () => {
        // Credentials were already accepted — an OAuth outage must degrade
        // the session, never fail the login/registration that produced it.
        oauthInitiateRequest.mockRejectedValue(new Error('proxy down'))

        await expect(
            acquireCardSessionTokens({
                accessToken: 'login-token',
                network: 'mainnet',
            }),
        ).resolves.toEqual({ accessToken: 'login-token', refreshToken: '' })
        expect(oauthTokenRequest).not.toHaveBeenCalled()
    })

    it('generates fresh PKCE material per attempt', async () => {
        oauthInitiateRequest.mockResolvedValue({ sessionToken: 'jwt-session' })
        oauthAuthorizeRequest.mockImplementation(async () => ({
            code: 'auth-code',
            state: oauthInitiateRequest.mock.calls.at(-1)?.[0].state,
        }))
        oauthTokenRequest.mockResolvedValue({
            accessToken: 'x',
            refreshToken: 'y',
        })

        await exchangeLoginForOauthTokens({
            accessToken: 'login-token',
            network: 'mainnet',
        })
        await exchangeLoginForOauthTokens({
            accessToken: 'login-token',
            network: 'mainnet',
        })

        const [first, second] = oauthInitiateRequest.mock.calls
        expect(first[0].codeChallenge).not.toBe(second[0].codeChallenge)
        expect(first[0].state).not.toBe(second[0].state)
    })
})
