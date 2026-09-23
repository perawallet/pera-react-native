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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    contactAddressFromItemKey,
    contactItemKey,
    isContactItemKey,
    isPasskeyItemKey,
    passkeyIdFromItemKey,
    passkeyItemKey,
} from '../itemKeys'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'

describe('contact item keys', () => {
    it('builds a contacts/ key from an address', () => {
        expect(contactItemKey('ADDR')).toBe('contacts/ADDR')
    })

    it('recognises only contacts/ keys', () => {
        expect(isContactItemKey('contacts/ADDR')).toBe(true)
        expect(isContactItemKey('accounts/ADDR')).toBe(false)
        expect(isContactItemKey('secrets/ADDR')).toBe(false)
    })

    it('reads the address back, and null for any other item', () => {
        expect(contactAddressFromItemKey('contacts/ADDR')).toBe('ADDR')
        expect(contactAddressFromItemKey('accounts/ADDR')).toBeNull()
    })
})

describe('passkey item keys', () => {
    it('builds and recognises a passkey key', () => {
        const key = passkeyItemKey('Y3JlZC1pZA==')

        // The id's bytes travel base64url-encoded; the raw id comes back.
        expect(key).toBe('passkeys/WTNKbFpDMXBaQT09')
        expect(isPasskeyItemKey(key)).toBe(true)
        expect(passkeyIdFromItemKey(key)).toBe('Y3JlZC1pZA==')
    })

    it('does not claim account or contact keys', () => {
        expect(isPasskeyItemKey('accounts/ADDR')).toBe(false)
        expect(isPasskeyItemKey('contacts/ADDR')).toBe(false)
        expect(passkeyIdFromItemKey('contacts/ADDR')).toBeNull()
    })
})

describe('passkey item keys', () => {
    // The server rejects any key whose `/`-separated segments are not
    // `[A-Za-z0-9_\-.]+`, and a credential id is standard base64: its `/`
    // would split the key into extra segments and `+`/`=` fail the pattern
    // outright. Proven against the real backend, which answered
    // `422 INVALID_ITEM_KEY`.
    const SERVER_SEGMENT = /^[A-Za-z0-9_\-.]+$/

    it('keeps every segment inside the alphabet the server accepts', () => {
        const credentialId = encodeToBase64(
            Uint8Array.from({ length: 32 }, (_, i) => i * 8 + 3),
        )
        expect(credentialId).toMatch(/[+/=]/)

        const key = passkeyItemKey(credentialId)

        for (const segment of key.split('/')) {
            expect(segment).toMatch(SERVER_SEGMENT)
        }
    })

    it('round-trips the raw credential id the native record is stored under', () => {
        const credentialId = encodeToBase64(
            Uint8Array.from({ length: 32 }, (_, i) => i * 8 + 3),
        )

        expect(passkeyIdFromItemKey(passkeyItemKey(credentialId))).toBe(
            credentialId,
        )
    })
})
