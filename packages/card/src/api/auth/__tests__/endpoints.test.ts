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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../../transport', () => ({ getCardTransport: () => ({ request }) }))

import {
    loginRequest,
    oauthAuthorizeRequest,
    oauthInitiateRequest,
    oauthTokenRequest,
    refreshTokenRequest,
    sendLoginOtpRequest,
} from '../endpoints'

describe('auth endpoints', () => {
    beforeEach(() => vi.clearAllMocks())

    it('logs in via the default (direct) route', async () => {
        request.mockResolvedValue({
            data: {
                accessToken: 'a',
                refreshToken: 'r',
                expiresIn: 60,
                isOtpRequired: false,
            },
        })

        await loginRequest({
            email: 'e@x.com',
            password: 'pw',
            network: 'mainnet',
        })

        const call = request.mock.calls[0][0]
        expect(call).toEqual(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/login',
                data: expect.objectContaining({
                    email: 'e@x.com',
                    password: 'pw',
                }),
            }),
        )
        expect(call.route).toBeUndefined()
    })

    it('sends the login OTP via the direct route', async () => {
        request.mockResolvedValue({ data: { success: true } })

        await sendLoginOtpRequest({ userId: 'user-1', network: 'mainnet' })

        const call = request.mock.calls[0][0]
        expect(call).toEqual(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/login/otp',
                data: { userId: 'user-1' },
            }),
        )
        expect(call.route).toBeUndefined()
        expect(call.authenticated).toBeUndefined()
    })

    it('rejects when the OTP send reports success: false', async () => {
        request.mockResolvedValue({ data: { success: false } })

        await expect(
            sendLoginOtpRequest({ userId: 'user-1', network: 'mainnet' }),
        ).rejects.toThrow('Baanx declined to send the login OTP')
    })

    it('initiates OAuth via the proxy route (pinned client_id/redirect_uri)', async () => {
        request.mockResolvedValue({
            data: { token: 'jwt-session', url: 'https://hosted' },
        })

        const initiation = await oauthInitiateRequest({
            state: 'csrf-state-123',
            codeChallenge: 'challenge-abc',
            network: 'mainnet',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'proxy',
                method: 'GET',
                path: '/api/v3/baanx/oauth/initiate',
                params: {
                    state: 'csrf-state-123',
                    code_challenge: 'challenge-abc',
                },
            }),
        )
        expect(initiation.sessionToken).toBe('jwt-session')
    })

    it('authorizes directly with the ephemeral login Bearer, not the keystore', async () => {
        request.mockResolvedValue({
            data: { code: 'auth-code', state: 'csrf-state-123' },
        })

        const authorization = await oauthAuthorizeRequest({
            sessionToken: 'jwt-session',
            accessToken: 'login-access-token',
            network: 'mainnet',
        })

        const call = request.mock.calls[0][0]
        expect(call).toEqual(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/oauth/authorize',
                data: { token: 'jwt-session' },
                headers: { Authorization: 'Bearer login-access-token' },
            }),
        )
        // The login token is passed explicitly; the keystore Bearer (set via
        // `authenticated`) must stay off — no durable session exists yet.
        expect(call.route).toBeUndefined()
        expect(call.authenticated).toBeUndefined()
        expect(authorization).toEqual({
            code: 'auth-code',
            state: 'csrf-state-123',
        })
    })

    it('exchanges the authorization code via the proxy route', async () => {
        request.mockResolvedValue({
            data: { access_token: 'x', refresh_token: 'y', expires_in: 60 },
        })

        const tokens = await oauthTokenRequest({
            code: 'auth-code',
            codeVerifier: 'verifier-123',
            network: 'mainnet',
        })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'proxy',
                method: 'POST',
                path: '/api/v3/baanx/oauth/token',
                data: { code: 'auth-code', code_verifier: 'verifier-123' },
            }),
        )
        expect(tokens).toEqual({ accessToken: 'x', refreshToken: 'y' })
    })

    it('refreshes via the direct route with the x-client-key alone', async () => {
        request.mockResolvedValue({
            data: { access_token: 'x', refresh_token: 'y', expires_in: 60 },
        })

        await refreshTokenRequest({ refreshToken: 'r', network: 'mainnet' })

        const call = request.mock.calls[0][0]
        expect(call).toEqual(
            expect.objectContaining({
                method: 'POST',
                path: '/v1/auth/oauth/token',
                data: expect.objectContaining({
                    grant_type: 'refresh_token',
                    refresh_token: 'r',
                }),
            }),
        )
        // Direct (the proxy only accepts the authorization-code grant), and
        // never `authenticated` — a 401 here must not re-enter the refresh
        // handler.
        expect(call.route).toBeUndefined()
        expect(call.authenticated).toBeUndefined()
    })
})
