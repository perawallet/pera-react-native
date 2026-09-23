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
import { describe, test, expect } from 'vitest'
import { hashItemAddress } from '../../crypto/itemKeyHash'
import {
    accountItemKey,
    contactItemKey,
    isAccountItemKey,
    isContactItemKey,
    isLegacyItemKey,
    isPasskeyItemKey,
    passkeyItemKey,
    secretsItemKey,
} from '../itemKeys'

const ADDRESS = 'ADDRESS'
const HASH = hashItemAddress(ADDRESS, new Uint8Array(32).fill(1))
/** 58-char base32, the shape keys had before they were hashed. */
const LEGACY_ADDRESS =
    'QWERTYUIOPASDFGHJKLZXCVBNM234567QWERTYUIOPASDFGHJKLZXCVBNM'

describe('item keys', () => {
    test('files an account under the accounts/ prefix', () => {
        expect(accountItemKey(HASH)).toBe(`accounts/${HASH}`)
    })

    test('files key material under the secrets/ prefix', () => {
        expect(secretsItemKey(HASH)).toBe(`secrets/${HASH}`)
    })

    test('files a contact under the contacts/ prefix', () => {
        expect(contactItemKey(HASH)).toBe(`contacts/${HASH}`)
    })

    // The prefix is the only thing left a reader of a key can route on.
    test('classifies a key by its prefix alone', () => {
        expect(isAccountItemKey(accountItemKey(HASH))).toBe(true)
        expect(isAccountItemKey(secretsItemKey(HASH))).toBe(false)
        expect(isAccountItemKey(contactItemKey(HASH))).toBe(false)

        expect(isContactItemKey(contactItemKey(HASH))).toBe(true)
        expect(isContactItemKey(accountItemKey(HASH))).toBe(false)
        expect(isContactItemKey(secretsItemKey(HASH))).toBe(false)
    })

    describe('isLegacyItemKey', () => {
        test('accepts a hashed key as current', () => {
            expect(isLegacyItemKey(accountItemKey(HASH))).toBe(false)
        })

        test('flags a key filed under a plaintext address', () => {
            expect(isLegacyItemKey(`accounts/${LEGACY_ADDRESS}`)).toBe(true)
        })

        test('flags an uppercase-hex segment, which no hasher of ours emits', () => {
            expect(isLegacyItemKey(`accounts/${HASH.toUpperCase()}`)).toBe(true)
        })
    })

    test('never carries the address it was built from', () => {
        for (const key of [
            accountItemKey(HASH),
            secretsItemKey(HASH),
            contactItemKey(HASH),
        ]) {
            expect(key).not.toContain(ADDRESS)
        }
    })
})

describe('passkey item keys', () => {
    test('files a passkey under the passkeys/ prefix', () => {
        expect(passkeyItemKey(HASH)).toBe(`passkeys/${HASH}`)
    })

    test('does not claim account or contact keys', () => {
        expect(isPasskeyItemKey(passkeyItemKey(HASH))).toBe(true)
        expect(isPasskeyItemKey(accountItemKey(HASH))).toBe(false)
        expect(isPasskeyItemKey(contactItemKey(HASH))).toBe(false)
    })

    // The server rejects any key whose `/`-separated segments are not
    // `[A-Za-z0-9_\-.]+`. A credential id is standard base64, so keying on it
    // directly used to fail with `422 INVALID_ITEM_KEY` against the real
    // backend; hashing removed the whole class, and this holds it there.
    test('keeps every segment inside the alphabet the server accepts', () => {
        const credentialId = 'wBUdsS95inHH5hfnV24Dy/ySvSteNiqijEXnJ6RMHwc='
        const key = passkeyItemKey(
            hashItemAddress(credentialId, new Uint8Array(32).fill(1)),
        )

        expect(key).not.toContain(credentialId)
        for (const segment of key.split('/')) {
            expect(segment).toMatch(/^[A-Za-z0-9_\-.]+$/)
        }
    })
})
