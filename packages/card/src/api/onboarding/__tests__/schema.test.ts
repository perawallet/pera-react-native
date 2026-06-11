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

import { describe, it, expect } from 'vitest'
import {
    addressResponseSchema,
    onboardingDetailsResponseSchema,
    registerVerificationResponseSchema,
} from '../schema'

describe('addressResponseSchema', () => {
    it('parses a token-bearing response', () => {
        const parsed = addressResponseSchema.parse({
            accessToken: 'tok',
            onboardingId: 'ob_1',
        })
        expect(parsed).toEqual({ accessToken: 'tok', onboardingId: 'ob_1' })
    })

    it('accepts a null access token (US separate-mailing path)', () => {
        const parsed = addressResponseSchema.parse({
            accessToken: null,
            onboardingId: 'ob_1',
        })
        expect(parsed.accessToken).toBeNull()
    })

    it('rejects a response missing the onboarding id', () => {
        expect(() =>
            addressResponseSchema.parse({ accessToken: 'tok' }),
        ).toThrow()
    })
})

describe('registerVerificationResponseSchema', () => {
    it('parses the session url and rejects a missing one', () => {
        expect(
            registerVerificationResponseSchema.parse({
                sessionUrl: 'https://veriff/session',
            }).sessionUrl,
        ).toBe('https://veriff/session')
        expect(() => registerVerificationResponseSchema.parse({})).toThrow()
    })
})

describe('onboardingDetailsResponseSchema', () => {
    it('keeps the verification state and strips the profile fields', () => {
        const parsed = onboardingDetailsResponseSchema.parse({
            id: 'ob_1',
            firstName: 'John',
            verificationState: 'VERIFIED',
        })
        expect(parsed).toEqual({ verificationState: 'VERIFIED' })
    })
})
