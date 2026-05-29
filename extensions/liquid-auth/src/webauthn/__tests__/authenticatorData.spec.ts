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

import { sha256 } from '@noble/hashes/sha256'
import { describe, expect, it } from 'vitest'

import { buildAuthenticatorData } from '../authenticatorData'

const RP_ID = 'pera.app'

describe('buildAuthenticatorData', () => {
    it('produces a 37-byte structure without attested credential data', () => {
        const result = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: true, at: false },
            signCount: 0,
        })
        expect(result.length).toBe(37)
    })

    it('places sha256(rpId) in the first 32 bytes', () => {
        const result = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: false, at: false },
            signCount: 0,
        })
        const expected = sha256(new TextEncoder().encode(RP_ID))
        expect(Array.from(result.slice(0, 32))).toEqual(Array.from(expected))
    })

    it('sets the flags byte from up/uv/at bits', () => {
        const up = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: false, at: false },
            signCount: 0,
        })
        expect(up[32]).toBe(0x01)

        const upUv = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: true, at: false },
            signCount: 0,
        })
        expect(upUv[32]).toBe(0x05) // 0x01 | 0x04

        const all = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: true, at: true },
            signCount: 0,
            attestedCredentialData: {
                aaguid: new Uint8Array(16),
                credentialId: new Uint8Array(4),
                cosePublicKey: new Uint8Array(2),
            },
        })
        expect(all[32]).toBe(0x45) // 0x01 | 0x04 | 0x40
    })

    it('serializes signCount big-endian', () => {
        const result = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: false, at: false },
            signCount: 0x01020304,
        })
        expect(Array.from(result.slice(33, 37))).toEqual([
            0x01, 0x02, 0x03, 0x04,
        ])
    })

    it('appends attested credential data with a big-endian credIdLen', () => {
        const aaguid = new Uint8Array(16).fill(0xaa)
        const credentialId = new Uint8Array([1, 2, 3, 4, 5])
        const cosePublicKey = new Uint8Array([0x77, 0x88])
        const result = buildAuthenticatorData({
            rpId: RP_ID,
            flags: { up: true, uv: true, at: true },
            signCount: 0,
            attestedCredentialData: { aaguid, credentialId, cosePublicKey },
        })

        // 37 base + 16 aaguid + 2 credIdLen + 5 credId + 2 cose
        expect(result.length).toBe(37 + 16 + 2 + 5 + 2)
        expect(Array.from(result.slice(37, 53))).toEqual(Array.from(aaguid))
        expect(Array.from(result.slice(53, 55))).toEqual([0x00, 0x05]) // credIdLen BE
        expect(Array.from(result.slice(55, 60))).toEqual(
            Array.from(credentialId),
        )
        expect(Array.from(result.slice(60, 62))).toEqual(
            Array.from(cosePublicKey),
        )
    })

    it('throws when AT is set but attested credential data is missing', () => {
        expect(() =>
            buildAuthenticatorData({
                rpId: RP_ID,
                flags: { up: true, uv: true, at: true },
                signCount: 0,
            }),
        ).toThrow()
    })
})
