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

import { loginRequest, refreshTokenRequest } from '../endpoints'

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

    it('refreshes via the proxy route (server-only x-secret-key)', async () => {
        request.mockResolvedValue({
            data: { access_token: 'x', refresh_token: 'y', expires_in: 60 },
        })

        await refreshTokenRequest({ refreshToken: 'r', network: 'mainnet' })

        expect(request).toHaveBeenCalledWith(
            expect.objectContaining({
                route: 'proxy',
                path: '/v1/auth/oauth/token',
                data: expect.objectContaining({
                    grant_type: 'refresh_token',
                    refresh_token: 'r',
                }),
            }),
        )
    })
})
