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

import { createCipheriv, createDecipheriv } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import { VaultLockedError } from '../../errors'
import { createVault } from '../../vault/vault'
import { decryptData, encryptData, readMasterKey } from '../crypto'

const KEY = new Uint8Array(32).fill(7)
const KEY_ID = 'key-abc'
// What crypto.ts binds as GCM additional authenticated data.
const AAD = Buffer.from(`keystore:${KEY_ID}`, 'utf8')

describe('encryptData / decryptData', () => {
    it('round-trips', () => {
        const payload = encryptData(KEY, 'hello keystore', KEY_ID)
        expect(decryptData(KEY, payload, KEY_ID)).toBe('hello keystore')
    })

    it('produces the mobile payload shape plus a format marker', () => {
        const parsed = JSON.parse(encryptData(KEY, 'x', KEY_ID)) as Record<
            string,
            string
        >
        expect(Object.keys(parsed).sort()).toEqual([
            'content',
            'iv',
            'tag',
            'v',
        ])
        expect(Buffer.from(parsed.iv, 'base64')).toHaveLength(12)
        expect(Buffer.from(parsed.tag, 'base64')).toHaveLength(16)
    })

    it('decrypts payloads produced by mobile (node aes-256-gcm)', () => {
        // Byte-for-byte reproduction of react-native-keystore's encryptData.
        // These carry no `v`, so they are opened without AAD — read
        // compatibility is preserved unconditionally.
        const iv = Buffer.alloc(12, 3)
        const cipher = createCipheriv('aes-256-gcm', Buffer.from(KEY), iv)
        let encrypted = cipher.update('mobile-written-entry', 'utf8', 'base64')
        encrypted += cipher.final('base64')
        const mobilePayload = JSON.stringify({
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            content: encrypted,
        })
        expect(decryptData(KEY, mobilePayload, KEY_ID)).toBe(
            'mobile-written-entry',
        )
    })

    // Deliberate divergence from mobile's format, web-only: entries we write
    // are BOUND to their storage key so a local attacker cannot swap two
    // ciphertexts and have both still authenticate. The payload is otherwise
    // unchanged standard AES-256-GCM — this proves node opens it given the
    // same AAD, so interop stays available to any reader that adopts the
    // binding. Web keystore entries never travel to mobile (they live in
    // chrome.storage.local vs the OS keychain), which is why the one-way
    // divergence is acceptable.
    it('produces payloads readable by node aes-256-gcm bound to the same AAD', () => {
        const payload = JSON.parse(
            encryptData(KEY, 'web-written-entry', KEY_ID),
        ) as { iv: string; tag: string; content: string }
        const decipher = createDecipheriv(
            'aes-256-gcm',
            Buffer.from(KEY),
            Buffer.from(payload.iv, 'base64'),
        )
        decipher.setAAD(AAD)
        decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
        let decrypted = decipher.update(payload.content, 'base64', 'utf8')
        decrypted += decipher.final('utf8')
        expect(decrypted).toBe('web-written-entry')
    })

    // The attack the binding exists for: same master key, two storage slots.
    it('refuses a ciphertext moved to a different storage key', () => {
        const sealed = encryptData(KEY, 'secret-for-a', 'key-a')

        expect(() => decryptData(KEY, sealed, 'key-b')).toThrow()
        expect(decryptData(KEY, sealed, 'key-a')).toBe('secret-for-a')
    })

    it('throws on tampered ciphertext', () => {
        const parsed = JSON.parse(encryptData(KEY, 'x', KEY_ID)) as {
            iv: string
            tag: string
            content: string
        }
        parsed.tag = Buffer.alloc(16, 9).toString('base64')
        expect(() => decryptData(KEY, JSON.stringify(parsed), KEY_ID)).toThrow()
    })
})

describe('readMasterKey', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('throws VaultLockedError when locked', async () => {
        await expect(readMasterKey()).rejects.toBeInstanceOf(VaultLockedError)
    })

    it('returns the 32-byte session master key when unlocked', async () => {
        await createVault('pw')
        expect(await readMasterKey()).toHaveLength(32)
    })
})
