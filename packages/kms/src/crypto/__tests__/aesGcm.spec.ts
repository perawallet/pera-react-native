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
import { AesGcmOpenError, openAesGcm, sealAesGcm } from '../aesGcm'
import * as secureMemory from '../secure-memory'

const key = new Uint8Array(32).fill(7)
const otherKey = new Uint8Array(32).fill(9)
const aad = new TextEncoder().encode('accounts/ADDR')
const otherAad = new TextEncoder().encode('accounts/OTHER')

describe('sealAesGcm / openAesGcm', () => {
    it('round-trips plaintext', () => {
        const plaintext = JSON.stringify({ address: 'ADDR', name: 'Main' })

        expect(openAesGcm(sealAesGcm(plaintext, key, aad), key, aad)).toBe(
            plaintext,
        )
    })

    it('produces a different payload each call, from the random IV', () => {
        expect(sealAesGcm('hello', key, aad)).not.toBe(
            sealAesGcm('hello', key, aad),
        )
    })

    it('wipes the encoded plaintext buffer once sealed', () => {
        const wipe = vi.spyOn(secureMemory, 'zeroBytes')
        const secret = JSON.stringify({ mnemonic: 'x y z' })

        sealAesGcm(secret, key, aad)

        const wiped = wipe.mock.calls.at(-1)?.[0]
        expect(wiped).toHaveLength(new TextEncoder().encode(secret).length)
        expect((wiped as Uint8Array).every(byte => byte === 0)).toBe(true)
        wipe.mockRestore()
    })

    it('fails with the wrong key', () => {
        const payload = sealAesGcm('secret', key, aad)

        expect(() => openAesGcm(payload, otherKey, aad)).toThrow(
            AesGcmOpenError,
        )
    })

    it('fails when the AAD does not match, so payloads cannot be swapped', () => {
        const payload = sealAesGcm('secret', key, aad)

        expect(() => openAesGcm(payload, key, otherAad)).toThrow(
            AesGcmOpenError,
        )
    })

    it('reports a payload shorter than IV + tag through the reason discriminant', () => {
        // 4 raw bytes — far below the 12-byte IV + 16-byte tag minimum.
        try {
            openAesGcm('AAAAAA==', key, aad)
            expect.unreachable('expected the open to throw')
        } catch (error) {
            expect(error).toBeInstanceOf(AesGcmOpenError)
            expect((error as AesGcmOpenError).reason).toBe('too-short')
        }
    })
})
