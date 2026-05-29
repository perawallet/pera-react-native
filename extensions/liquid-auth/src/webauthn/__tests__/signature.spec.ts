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

import { p256 } from '@noble/curves/p256'
import { describe, expect, it } from 'vitest'

import { rawToDerEcdsaSignature } from '../signature'

const buildRaw = (r: bigint, s: bigint): Uint8Array => {
    const raw = new Uint8Array(64)
    const toBe = (value: bigint): Uint8Array => {
        const out = new Uint8Array(32)
        for (let i = 31; i >= 0; i -= 1) {
            out[i] = Number(value & 0xffn)
            value >>= 8n
        }
        return out
    }
    raw.set(toBe(r), 0)
    raw.set(toBe(s), 32)
    return raw
}

describe('rawToDerEcdsaSignature', () => {
    it('produces a DER SEQUENCE with the expected length header', () => {
        const raw = buildRaw(0x1234n, 0x5678n)
        const der = rawToDerEcdsaSignature(raw)
        expect(der[0]).toBe(0x30) // SEQUENCE
        // Total declared length matches the remaining bytes.
        expect(der[1]).toBe(der.length - 2)
    })

    it('round-trips r and s through @noble fromDER', () => {
        const r =
            0x00ff112233445566778899aabbccddeeff00112233445566778899aabbccddeen
        const s =
            0x7fabcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567n
        const raw = buildRaw(r, s)
        const der = rawToDerEcdsaSignature(raw)
        const parsed = p256.Signature.fromDER(der)
        expect(parsed.r).toBe(r)
        expect(parsed.s).toBe(s)
    })

    it('throws when the raw signature is not 64 bytes', () => {
        expect(() => rawToDerEcdsaSignature(new Uint8Array(63))).toThrow()
        expect(() => rawToDerEcdsaSignature(new Uint8Array(65))).toThrow()
    })
})
