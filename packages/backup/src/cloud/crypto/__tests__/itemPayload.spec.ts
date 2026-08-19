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

import { describe, expect, it, vi } from 'vitest'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    decryptItemPayload,
    encryptItemPayload,
    DecryptItemPayloadError,
} from '../itemPayload'

// Keep the real wipe running — we only need a handle on which buffer it got.
vi.mock('@perawallet/wallet-core-kms', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-kms')>()
    return { ...actual, zeroBytes: vi.fn(actual.zeroBytes) }
})

const decipherOutputs: Uint8Array[] = []

vi.mock('crypto', async importOriginal => {
    const actual = await importOriginal<typeof import('crypto')>()
    return {
        ...actual,
        createDecipheriv: (
            ...args: Parameters<typeof actual.createDecipheriv>
        ) => {
            const decipher = actual.createDecipheriv(...args)
            const update = decipher.update.bind(decipher)
            const final = decipher.final.bind(decipher)
            decipher.update = ((...a: Parameters<typeof update>) => {
                const out = update(...a)
                decipherOutputs.push(out)
                return out
            }) as typeof decipher.update
            decipher.final = ((...a: Parameters<typeof final>) => {
                const out = final(...a)
                decipherOutputs.push(out)
                return out
            }) as typeof decipher.final
            return decipher
        },
    }
})

const zeroBytesSpy = vi.mocked(zeroBytes)

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

    it('leaves no decrypted buffer holding the secret', () => {
        const secret = JSON.stringify({ type: 'quantum', mnemonic: 'a b c' })
        const payload = encryptItemPayload(secret, ctx)
        decipherOutputs.length = 0

        expect(decryptItemPayload(payload, ctx)).toBe(secret)

        const produced = decipherOutputs.reduce((n, b) => n + b.length, 0)
        expect(produced).toBe(new TextEncoder().encode(secret).length)
        for (const buf of decipherOutputs) {
            expect(buf.every(byte => byte === 0)).toBe(true)
        }
    })

    it('wipes the encoded plaintext buffer on the encrypt side', () => {
        const secret = JSON.stringify({ type: 'algo25', mnemonic: 'x y z' })
        zeroBytesSpy.mockClear()

        encryptItemPayload(secret, ctx)

        const wiped = zeroBytesSpy.mock.calls.at(-1)?.[0]
        expect(wiped).toHaveLength(new TextEncoder().encode(secret).length)
        expect((wiped as Uint8Array).every(byte => byte === 0)).toBe(true)
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

    // GCM streams plaintext out of `update()` before `final()` checks the tag,
    // so a tampered payload hands back the real phrase and only then throws.
    it('wipes the decrypted buffers when authentication fails', () => {
        const secret = JSON.stringify({ type: 'quantum', mnemonic: 'a b c' })
        const payload = encryptItemPayload(secret, ctx)
        decipherOutputs.length = 0

        expect(() =>
            decryptItemPayload(payload, { ...ctx, key: 'accounts/OTHER' }),
        ).toThrow(DecryptItemPayloadError)

        const produced = decipherOutputs.reduce((n, b) => n + b.length, 0)
        expect(produced).toBe(new TextEncoder().encode(secret).length)
        for (const buf of decipherOutputs) {
            expect(buf.every(byte => byte === 0)).toBe(true)
        }
    })

    it('fails when the payload is shorter than IV + tag', () => {
        // 4 raw bytes — far below the 12-byte IV + 16-byte tag minimum.
        expect(() => decryptItemPayload('AAAAAA==', ctx)).toThrow(
            DecryptItemPayloadError,
        )
    })
})
