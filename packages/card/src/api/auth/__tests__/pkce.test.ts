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
import { createCodeChallenge, createOauthState, createPkcePair } from '../pkce'

describe('pkce', () => {
    it('derives the RFC 7636 appendix-B challenge from its verifier', () => {
        // Known-answer test from the PKCE spec: any deviation in hashing or
        // base64url encoding (padding, +/ chars) breaks Baanx's S256 check.
        expect(
            createCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
        ).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    })

    it('generates a spec-compliant verifier/challenge pair', () => {
        const { codeVerifier, codeChallenge } = createPkcePair()

        // 32 random bytes → 43 base64url chars, the RFC 7636 minimum length,
        // drawn from the unreserved subset Baanx validates ([A-Za-z0-9_-]).
        expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(codeChallenge).toBe(createCodeChallenge(codeVerifier))
    })

    it('generates unique verifiers per pair', () => {
        expect(createPkcePair().codeVerifier).not.toBe(
            createPkcePair().codeVerifier,
        )
    })

    it('generates a unique CSRF state of at least 8 chars', () => {
        const state = createOauthState()
        expect(state).toMatch(/^[A-Za-z0-9_-]{8,}$/)
        expect(createOauthState()).not.toBe(state)
    })
})
