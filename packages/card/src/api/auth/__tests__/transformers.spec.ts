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

import { describe, it, expect } from 'vitest'
import {
    transformLoginResponse,
    transformOauthAuthorizeResponse,
    transformOauthInitiateResponse,
    transformTokenResponse,
} from '../transformers'

describe('auth transformers', () => {
    it('maps a login response (access token only, no refresh)', () => {
        const result = transformLoginResponse({
            accessToken: 'a',
            userId: 'u1',
            isOtpRequired: false,
            phase: 'PHONE_NUMBER',
            verificationState: 'VERIFIED',
            isLinked: true,
        })

        expect(result.accessToken).toBe('a')
        expect(result.userId).toBe('u1')
        expect(result.isOtpRequired).toBe(false)
        expect(result.phase).toBe('PHONE_NUMBER')
        expect(result.verificationState).toBe('VERIFIED')
        expect(result.isLinked).toBe(true)
    })

    it('returns a null access token when OTP is required', () => {
        const result = transformLoginResponse({
            accessToken: null,
            isOtpRequired: true,
        })

        expect(result.accessToken).toBeNull()
        expect(result.isOtpRequired).toBe(true)
    })

    it('maps unknown phase/verification values to null', () => {
        const result = transformLoginResponse({
            accessToken: 'a',
            phase: 'WAT',
            verificationState: 'NOPE',
        })

        expect(result.phase).toBeNull()
        expect(result.verificationState).toBeNull()
    })

    it('transforms an OAuth token response into session tokens', () => {
        const tokens = transformTokenResponse({
            access_token: 'x',
            refresh_token: 'y',
            expires_in: 21600,
        })

        expect(tokens.accessToken).toBe('x')
        expect(tokens.refreshToken).toBe('y')
    })

    it('maps the initiate response token to the OAuth session token', () => {
        const initiation = transformOauthInitiateResponse({
            token: 'jwt-session',
        })

        expect(initiation.sessionToken).toBe('jwt-session')
    })

    it('maps the authorize response to code + echoed state', () => {
        const authorization = transformOauthAuthorizeResponse({
            code: 'auth-code',
            state: 'csrf-state',
        })

        expect(authorization.code).toBe('auth-code')
        expect(authorization.state).toBe('csrf-state')
    })
})
