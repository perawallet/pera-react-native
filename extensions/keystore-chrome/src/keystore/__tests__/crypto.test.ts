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

    // `delete key.privateKey` alone satisfies the assertion above, so dropping
    // the `clearBuffer` call would be invisible there. Hold the buffer across
    // the call and inspect the bytes themselves: the secret must be zeroed in
    // place, not merely dereferenced (any other live alias still sees it).
    it('clearKeyData zeroes the private key bytes in place, not just the property', () => {
        const buffer = makeUint8([5, 6, 7, 8])
        const key: Partial<KeyData> = { privateKey: buffer } as any

        clearKeyData(key)

        expect(key.privateKey).toBeUndefined()
        expect(Array.from(buffer)).toEqual([0, 0, 0, 0])
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

    // The symmetric key is derived as generichash(32, key.publicKey). Replacing
    // that derivation with a constant would encrypt every user's data under one
    // global key while leaving the roundtrip above green, so pin the binding
    // directly: same plaintext, same (stubbed, deterministic) nonce, different
    // public key => the ciphertext must differ.
    it('encryptWithKeyData binds the ciphertext to the public key', async () => {
        const plaintext = makeUint8([100, 101, 102])
        const base = {
            id: 'k1',
            type: 'ecc',
            algorithm: 'raw',
            extractable: false,
        } as const

        const first = (await encryptWithKeyData({
            key: { ...base, publicKey: makeUint8([10, 11, 12]) },
            data: plaintext,
        })) as Uint8Array
        const second = (await encryptWithKeyData({
            key: { ...base, publicKey: makeUint8([20, 21, 22]) },
            data: plaintext,
        })) as Uint8Array

        // Nonce is stubbed deterministically, so any difference is key-derived.
        expect(Array.from(first.slice(0, 24))).toEqual(
            Array.from(second.slice(0, 24)),
        )
        expect(Array.from(first.slice(24))).not.toEqual(
            Array.from(second.slice(24)),
        )
    })

    it('decryptWithKeyData rejects a ciphertext encrypted under a different public key', async () => {
        const plaintext = makeUint8([100, 101, 102])
        const base = {
            id: 'k1',
            type: 'ecc',
            algorithm: 'raw',
            extractable: false,
        } as const

        const encrypted = (await encryptWithKeyData({
            key: { ...base, publicKey: makeUint8([10, 11, 12]) },
            data: plaintext,
        })) as Uint8Array

        await expect(
            decryptWithKeyData({
                key: { ...base, publicKey: makeUint8([20, 21, 22]) },
                data: encrypted,
            }),
        ).rejects.toThrow()
    })

    it('decryptWithKeyData rejects a tampered ciphertext under the correct key', async () => {
        const key = {
            id: 'k1',
            type: 'ecc',
            algorithm: 'raw',
            extractable: false,
            publicKey: makeUint8([10, 11, 12]),
        } as const

        const encrypted = (await encryptWithKeyData({
            key: { ...key },
            data: makeUint8([100, 101, 102]),
        })) as Uint8Array

        const tampered = new Uint8Array(encrypted)
        // Flip a bit inside the ciphertext body, past the 24-byte nonce.
        tampered[25] ^= 0x01

        await expect(
            decryptWithKeyData({ key: { ...key }, data: tampered }),
        ).rejects.toThrow()
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
