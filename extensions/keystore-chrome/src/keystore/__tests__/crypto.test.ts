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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 crypto.test.ts
// Portions Copyright Algorand Foundation, Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearKeyData, decryptWithKeyData, encryptWithKeyData } from '../crypto'
import type { KeyData } from '../types'

// Helpers
const makeUint8 = (arr: number[]) => new Uint8Array(arr)

describe('crypto.ts', () => {
    beforeEach(() => {
        // Spy on the real Crypto instance's method instead of replacing
        // `globalThis.crypto` with an object-literal clone: Crypto's members
        // (getRandomValues, subtle, ...) live on the prototype, so
        // `{ ...globalThis.crypto }` copies nothing and a naive restore
        // leaves `globalThis.crypto` a plain Object with `subtle` gone.
        vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(
            (buf: any) => {
                for (let i = 0; i < buf.length; i++) buf[i] = i // 00,01,02,...
                return buf
            },
        )
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('clearKeyData removes privateKey field if present', () => {
        const key: Partial<KeyData> = {
            privateKey: makeUint8([5, 6, 7]),
        } as any
        clearKeyData(key)
        expect(key.privateKey).toBeUndefined()
    })

    it('encryptWithKeyData + decryptWithKeyData roundtrip', async () => {
        const key: KeyData = {
            id: 'k1',
            type: 'ecc',
            algorithm: 'raw',
            extractable: false,
            publicKey: makeUint8([10, 11, 12]),
        }
        const plaintext = makeUint8([100, 101, 102])

        const encrypted = await encryptWithKeyData({
            key: { ...key },
            data: plaintext,
        })
        // Expect nonce(24 bytes) + transformed ciphertext
        expect((encrypted as Uint8Array).length).toBe(
            24 + plaintext.length + 16,
        )

        const decrypted = await decryptWithKeyData({
            key: { ...key },
            data: encrypted as Uint8Array,
        })
        expect(Array.from(decrypted as Uint8Array)).toEqual(
            Array.from(plaintext),
        )
    })
})

// Runs outside the `crypto.ts` describe above so the deterministic
// getRandomValues stub in its beforeEach never applies here — this is the
// only test exercising the real crypto.getRandomValues nonce path.
describe('crypto.ts nonce randomness (real crypto.getRandomValues)', () => {
    it('encryptWithKeyData produces a different nonce on each call for the same key and plaintext', async () => {
        const key: KeyData = {
            id: 'k1',
            type: 'ecc',
            algorithm: 'raw',
            extractable: false,
            publicKey: makeUint8([10, 11, 12]),
        }
        const plaintext = makeUint8([100, 101, 102])

        const first = (await encryptWithKeyData({
            key: { ...key },
            data: plaintext,
        })) as Uint8Array
        const second = (await encryptWithKeyData({
            key: { ...key },
            data: plaintext,
        })) as Uint8Array

        expect(Array.from(first.slice(0, 24))).not.toEqual(
            Array.from(second.slice(0, 24)),
        )
    })

    // Proves the `vi.spyOn` fix in the describe above actually restores the
    // real Crypto instance rather than leaving a crippled plain-object stand-in.
    // Task 7 vendors sign/verify, which depend on crypto.subtle — a broken
    // restore here would fail those tests for a reason unrelated to their own code.
    it('leaves globalThis.crypto as the real Crypto instance after the stubbing describe above has run', () => {
        expect(globalThis.crypto instanceof Crypto).toBe(true)
        expect(typeof globalThis.crypto.subtle).toBe('object')
        expect(typeof globalThis.crypto.subtle.digest).toBe('function')
    })
})
