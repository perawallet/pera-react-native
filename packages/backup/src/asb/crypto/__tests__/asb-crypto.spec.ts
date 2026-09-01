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
import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import nacl from 'tweetnacl'
import { mnemonicWordsToIndices } from '@perawallet/wallet-core-kms'
import { backupIndicesToKey, generateBackupCipherKey } from '../asb-crypto'

// BIP-39 well-known zero-entropy vector. The 12-word phrase
// "abandon abandon abandon abandon abandon abandon abandon abandon
//  abandon abandon abandon about" decodes to 16 zero bytes.
const ZERO_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const ZERO_ENTROPY = new Uint8Array(16)
const zeroIndices = () => mnemonicWordsToIndices(ZERO_MNEMONIC.split(' '))!

describe('backupIndicesToKey', () => {
    it('returns the 16-byte BIP-39 entropy for the zero-vector phrase', () => {
        expect(Array.from(backupIndicesToKey(zeroIndices()))).toEqual(
            Array.from(ZERO_ENTROPY),
        )
    })

    it('throws on an invalid BIP-39 checksum', () => {
        // Swap the last "about" for "abandon" → checksum breaks.
        const invalid = zeroIndices()
        invalid[11] = 0
        expect(() => backupIndicesToKey(invalid)).toThrow()
    })

    it('throws on the wrong word count', () => {
        expect(() => backupIndicesToKey(new Uint16Array(2))).toThrow()
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

// Secretbox open is now a shared primitive — see
// `packages/backup/src/shared/__tests__/secretbox.spec.ts`.
