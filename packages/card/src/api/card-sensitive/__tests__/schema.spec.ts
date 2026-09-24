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
    cardSecureViewResponseSchema,
    cardSetPinSessionResponseSchema,
} from '../schema'

const HOSTILE_URLS = [
    'http://host/set-pin',
    'javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'perawallet://app/import',
    'content://com.evil.provider/secret',
]

describe('cardSetPinSessionResponseSchema', () => {
    it('parses a hosted page url served over https', () => {
        expect(
            cardSetPinSessionResponseSchema.parse({
                token: 'tok-3',
                hostedPageUrl: 'https://host/pin-direct/set?token=tok-3',
            }),
        ).toEqual({
            token: 'tok-3',
            hostedPageUrl: 'https://host/pin-direct/set?token=tok-3',
        })
    })

    // Rejecting here is what keeps these schemes out of Linking.openURL.
    it.each(HOSTILE_URLS)('rejects a %s hosted page url', hostedPageUrl => {
        expect(() =>
            cardSetPinSessionResponseSchema.parse({
                token: 'tok-3',
                hostedPageUrl,
            }),
        ).toThrow()
    })
})

describe('cardSecureViewResponseSchema', () => {
    it('parses an image url served over https', () => {
        expect(
            cardSecureViewResponseSchema.parse({
                token: 'tok-1',
                imageUrl: 'https://host/details-image?token=tok-1',
            }).imageUrl,
        ).toBe('https://host/details-image?token=tok-1')
    })

    it.each(HOSTILE_URLS)('rejects a %s image url', imageUrl => {
        expect(() =>
            cardSecureViewResponseSchema.parse({ token: 'tok-1', imageUrl }),
        ).toThrow()
    })
})
