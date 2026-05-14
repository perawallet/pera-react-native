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
import nacl from 'tweetnacl'
import { secretboxOpenWithPrependedNonce } from '../secretbox'

const seal = (plaintext: Uint8Array, key: Uint8Array): Uint8Array => {
    const nonce = nacl.randomBytes(24)
    // Re-wrap to handle the jsdom-realm Uint8Array mismatch (tweetnacl uses
    // `instanceof Uint8Array`, which fails across realms).
    const box = nacl.secretbox(Uint8Array.from(plaintext), nonce, key)
    const out = new Uint8Array(24 + box.length)
    out.set(nonce, 0)
    out.set(box, 24)
    return out
}

describe('secretboxOpenWithPrependedNonce', () => {
    const plaintext = Uint8Array.from(
        new TextEncoder().encode(JSON.stringify({ accounts: [] })),
    )
    const KEY = new Uint8Array(nacl.secretbox.keyLength).fill(7)

    it('decrypts a payload produced by tweetnacl.secretbox with prepended nonce', () => {
        const sealed = seal(plaintext, KEY)
        const opened = secretboxOpenWithPrependedNonce(sealed, KEY)
        expect(opened).not.toBeNull()
        expect(Array.from(opened!)).toEqual(Array.from(plaintext))
    })

    it('returns null when the key is wrong (MAC fails)', () => {
        const sealed = seal(plaintext, KEY)
        const wrong = new Uint8Array(nacl.secretbox.keyLength).fill(0xff)
        expect(secretboxOpenWithPrependedNonce(sealed, wrong)).toBeNull()
    })

    it('returns null when the ciphertext is shorter than the nonce', () => {
        expect(
            secretboxOpenWithPrependedNonce(new Uint8Array(10), KEY),
        ).toBeNull()
        expect(
            secretboxOpenWithPrependedNonce(new Uint8Array(24), KEY),
        ).toBeNull()
    })

    it('returns null when the ciphertext has been tampered with', () => {
        const sealed = seal(plaintext, KEY)
        // Flip a byte in the sealed region (past the 24-byte nonce).
        const tampered = sealed.slice()
        tampered[30] ^= 0xff
        expect(secretboxOpenWithPrependedNonce(tampered, KEY)).toBeNull()
    })
})
