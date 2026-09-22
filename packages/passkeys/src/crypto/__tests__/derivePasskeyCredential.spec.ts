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

import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

// Same technique as `writeNativePasskeyEntry.spec.ts`: the real native module
// has no loadable build here, and every test below passes `subtle` explicitly.
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '../derivePasskeyCredential'

const subtle = webcrypto.subtle as unknown as SubtleCrypto

// Fixed 32-byte BIP39 entropy. Pinned so a change to the KDF parameters shows
// up as a failing vector rather than as silently unreproducible credentials.
const ENTROPY = new Uint8Array(32).fill(7)

describe('derivePasskeyMainKey', () => {
    it('produces 64 bytes and is deterministic for the same entropy', async () => {
        const first = await derivePasskeyMainKey(ENTROPY, subtle)
        const second = await derivePasskeyMainKey(ENTROPY, subtle)

        expect(first).toHaveLength(64)
        expect(Array.from(first)).toEqual(Array.from(second))
    })

    it('produces a different key for different entropy', async () => {
        const other = new Uint8Array(32).fill(9)

        const first = await derivePasskeyMainKey(ENTROPY, subtle)
        const second = await derivePasskeyMainKey(other, subtle)

        expect(Array.from(first)).not.toEqual(Array.from(second))
    })
})

describe('derivePasskeyCredential', () => {
    it('is deterministic for the same inputs', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)

        const first = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })
        const second = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })

        expect(first.credentialId).toBe(second.credentialId)
        expect(first.publicKeySpkiDer).toHaveLength(91)
    })

    it('derives a different key for a different identity', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)

        const alice = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })
        const bob = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'bob',
        })

        expect(alice.credentialId).not.toBe(bob.credentialId)
    })

    it('derives a different key for a different counter', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)

        const zero = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
            counter: 0,
        })
        const one = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
            counter: 1,
        })

        expect(zero.credentialId).not.toBe(one.credentialId)
    })

    it('derives a different key for a different origin', async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)

        const a = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })
        const b = await derivePasskeyCredential({
            mainKey,
            origin: 'example.com',
            identity: 'alice',
        })

        expect(a.credentialId).not.toBe(b.credentialId)
    })
})
