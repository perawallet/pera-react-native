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

import { describe, expect, it } from 'vitest'
import { messageSignerChainAdapters } from '../../message-signer'
import { isAuthDataOriginMismatch } from '../authDataOrigin'

describe('isAuthDataOriginMismatch', () => {
    it('returns false when no verified origin is available', () => {
        expect(isAuthDataOriginMismatch('example.io', undefined)).toBe(false)
        expect(isAuthDataOriginMismatch('example.io', '')).toBe(false)
    })

    it('returns false when the verified origin host matches the domain', () => {
        expect(
            isAuthDataOriginMismatch(
                'example.io',
                'https://example.io/sign-in',
            ),
        ).toBe(false)
    })

    it('matches case-insensitively and ignores path/scheme on the origin', () => {
        expect(
            isAuthDataOriginMismatch(
                'EXAMPLE.io',
                'https://example.io/a/b?c=d',
            ),
        ).toBe(false)
    })

    it('matches when the domain itself carries a scheme', () => {
        expect(
            isAuthDataOriginMismatch(
                'https://example.io',
                'https://example.io/x',
            ),
        ).toBe(false)
    })

    it('returns true when the origin host differs from the domain', () => {
        expect(
            isAuthDataOriginMismatch(
                'trusted-exchange.com',
                'https://evil.example/phish',
            ),
        ).toBe(true)
    })

    it('treats a differing port as a mismatch', () => {
        expect(
            isAuthDataOriginMismatch('example.io:8080', 'https://example.io/x'),
        ).toBe(true)
    })

    it('matches a bare host:port domain against the same-port origin', () => {
        expect(
            isAuthDataOriginMismatch(
                'example.io:8080',
                'https://example.io:8080/x',
            ),
        ).toBe(false)
        expect(
            isAuthDataOriginMismatch('localhost:3000', 'http://localhost:3000'),
        ).toBe(false)
    })

    it('normalizes an explicit default port on either side', () => {
        expect(
            isAuthDataOriginMismatch('example.io:443', 'https://example.io/x'),
        ).toBe(false)
    })

    it('treats a domain smuggling userinfo as a mismatch', () => {
        // "trusted.com@evil.com" displays a trusted-looking string while its
        // URL host is evil.com — must warn even when served from evil.com.
        expect(
            isAuthDataOriginMismatch(
                'trusted.com@evil.com',
                'https://evil.com',
            ),
        ).toBe(true)
    })

    it('still flags a mismatch with no message signer registered', () => {
        messageSignerChainAdapters.reset()

        expect(isAuthDataOriginMismatch('example.io', 'https://evil.com')).toBe(
            true,
        )
    })
})
