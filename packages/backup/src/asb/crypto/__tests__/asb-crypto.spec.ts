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
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import nacl from 'tweetnacl'
import {
    asbSecretboxOpen,
    backupMnemonicToKey,
    generateBackupCipherKey,
} from '../asb-crypto'

// BIP-39 well-known zero-entropy vector. The 12-word phrase
// "abandon abandon abandon abandon abandon abandon abandon abandon
//  abandon abandon abandon about" decodes to 16 zero bytes.
const ZERO_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ZERO_ENTROPY = new Uint8Array(16)

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

describe('backupMnemonicToKey', () => {
    it('returns the 16-byte BIP-39 entropy for the zero-vector phrase', () => {
        expect(Array.from(backupMnemonicToKey(ZERO_MNEMONIC))).toEqual(
            Array.from(ZERO_ENTROPY),
        )
    })

    it('normalizes inner whitespace and trims', () => {
        const messy = `  ${ZERO_MNEMONIC.split(' ').join('   ')}\n`
        expect(Array.from(backupMnemonicToKey(messy))).toEqual(
            Array.from(ZERO_ENTROPY),
        )
    })

    it('throws on an invalid BIP-39 checksum', () => {
        // Swap the last "about" for "abandon" → checksum breaks.
        const invalid = ZERO_MNEMONIC.replace(/about$/, 'abandon')
        expect(() => backupMnemonicToKey(invalid)).toThrow()
    })

    it('throws on the wrong word count', () => {
        expect(() => backupMnemonicToKey('abandon abandon')).toThrow()
    })
})

describe('generateBackupCipherKey', () => {
    it('uses HMAC-SHA256 with "Algorand export 1.0" as the KEY (not the message)', () => {
        const seed = ZERO_ENTROPY
        // Argument order matters: key first, then message. Swapping them
        // would silently produce a different (wrong) 32-byte digest.
        const expected = hmac(
            sha256,
            new TextEncoder().encode('Algorand export 1.0'),
            seed,
        )

        const actual = generateBackupCipherKey(seed)
        expect(actual.length).toBe(32)
        expect(Array.from(actual)).toEqual(Array.from(expected))
    })

    it('is deterministic', () => {
        const a = generateBackupCipherKey(ZERO_ENTROPY)
        const b = generateBackupCipherKey(ZERO_ENTROPY)
        expect(Array.from(a)).toEqual(Array.from(b))
    })

    it('produces a key suitable for nacl.secretbox (32 bytes)', () => {
        const key = generateBackupCipherKey(ZERO_ENTROPY)
        expect(key.byteLength).toBe(nacl.secretbox.keyLength)
    })
})

describe('asbSecretboxOpen', () => {
    const plaintext = Uint8Array.from(
        new TextEncoder().encode(
            JSON.stringify({ accounts: [], provider_name: 'test' }),
        ),
    )

    it('decrypts a payload produced by tweetnacl.secretbox with prepended nonce', () => {
        const key = generateBackupCipherKey(ZERO_ENTROPY)
        const sealed = seal(plaintext, key)

        const opened = asbSecretboxOpen(sealed, key)
        expect(opened).not.toBeNull()
        expect(Array.from(opened!)).toEqual(Array.from(plaintext))
    })

    it('returns null when the recovery key is wrong (MAC fails)', () => {
        const realKey = generateBackupCipherKey(ZERO_ENTROPY)
        const fakeKey = generateBackupCipherKey(new Uint8Array(16).fill(1))

        const sealed = seal(plaintext, realKey)
        expect(asbSecretboxOpen(sealed, fakeKey)).toBeNull()
    })

    it('returns null when the ciphertext is shorter than the nonce', () => {
        const key = generateBackupCipherKey(ZERO_ENTROPY)
        expect(asbSecretboxOpen(new Uint8Array(10), key)).toBeNull()
        expect(asbSecretboxOpen(new Uint8Array(24), key)).toBeNull()
    })

    it('returns null when the ciphertext has been tampered with', () => {
        const key = generateBackupCipherKey(ZERO_ENTROPY)
        const sealed = seal(plaintext, key)
        // Flip a byte in the sealed region (past the 24-byte nonce).
        const tampered = sealed.slice()
        tampered[30] ^= 0xff
        expect(asbSecretboxOpen(tampered, key)).toBeNull()
    })
})
