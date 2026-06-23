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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    decryptItemPayload,
    encryptItemPayload,
    DecryptItemPayloadError,
} from '../itemPayload'

const key = new Uint8Array(32).fill(7)
const ctx = {
    encryptionKey: key,
    backupId: 'did:pera:ADDR',
    key: 'accounts/ADDR',
}

describe('item payload crypto', () => {
    it('round-trips plaintext JSON', () => {
        const plaintext = JSON.stringify({
            address: 'ADDR',
            customName: 'Main',
        })
        const payload = encryptItemPayload(plaintext, ctx)
        expect(decryptItemPayload(payload, ctx)).toBe(plaintext)
    })

    it('produces a different ciphertext each call (random IV)', () => {
        const a = encryptItemPayload('hello', ctx)
        const b = encryptItemPayload('hello', ctx)
        expect(a).not.toBe(b)
    })

    it('fails with the wrong key', () => {
        const payload = encryptItemPayload('secret', ctx)
        expect(() =>
            decryptItemPayload(payload, {
                ...ctx,
                encryptionKey: new Uint8Array(32).fill(9),
            }),
        ).toThrow(DecryptItemPayloadError)
    })

    it('fails when the AAD (key) does not match', () => {
        const payload = encryptItemPayload('secret', ctx)
        expect(() =>
            decryptItemPayload(payload, { ...ctx, key: 'accounts/OTHER' }),
        ).toThrow(DecryptItemPayloadError)
    })

    it('fails when the payload is shorter than IV + tag', () => {
        // 4 raw bytes — far below the 12-byte IV + 16-byte tag minimum.
        expect(() => decryptItemPayload('AAAAAA==', ctx)).toThrow(
            DecryptItemPayloadError,
        )
    })
})
