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

import { describe, expect, it } from 'vitest'
import { sha256 } from '@noble/hashes/sha2'
import {
    AAGUID,
    attestationObjectNone,
    attestedCredentialData,
    authenticatorData,
    coseKeyP256,
    splitP256PublicKey,
} from '../webauthn-structures'

const X = new Uint8Array(32).fill(0x11)
const Y = new Uint8Array(32).fill(0x22)
const CREDENTIAL_ID = new Uint8Array([0xca, 0xfe, 0xba, 0xbe])

describe('AAGUID', () => {
    it('is the 16 raw bytes of 1F59713A-C021-4E63-9158-2CC5FDC14E52 in UUID field order', () => {
        expect(Array.from(AAGUID)).toEqual([
            0x1f, 0x59, 0x71, 0x3a, 0xc0, 0x21, 0x4e, 0x63, 0x91, 0x58, 0x2c,
            0xc5, 0xfd, 0xc1, 0x4e, 0x52,
        ])
    })
})

describe('coseKeyP256', () => {
    it('encodes {1:2, 3:-7, -1:1, -2:x, -3:y} as CBOR, pairs in that exact order', () => {
        const encoded = coseKeyP256(X, Y)

        expect(Array.from(encoded)).toEqual([
            0xa5,
            0x01,
            0x02,
            0x03,
            0x26,
            0x20,
            0x01,
            0x21,
            0x58,
            0x20,
            ...X,
            0x22,
            0x58,
            0x20,
            ...Y,
        ])
    })
})

describe('attestedCredentialData', () => {
    it('is AAGUID(16) || credIdLen(2, BE) || credentialId || COSEkey', () => {
        const result = attestedCredentialData(CREDENTIAL_ID, { x: X, y: Y })
        const cose = coseKeyP256(X, Y)

        expect(result.length).toBe(16 + 2 + CREDENTIAL_ID.length + cose.length)
        expect(Array.from(result.slice(0, 16))).toEqual(Array.from(AAGUID))
        expect(Array.from(result.slice(16, 18))).toEqual([0x00, 0x04])
        expect(Array.from(result.slice(18, 18 + CREDENTIAL_ID.length))).toEqual(
            Array.from(CREDENTIAL_ID),
        )
        expect(Array.from(result.slice(18 + CREDENTIAL_ID.length))).toEqual(
            Array.from(cose),
        )
    })
})

describe('authenticatorData', () => {
    it('for an assertion (no attested data) is SHA256(rpId) || 0x1D || 00000000, 37 bytes', async () => {
        const expectedDigest = sha256(new TextEncoder().encode('webauthn.io'))

        const result = await authenticatorData({
            rpId: 'webauthn.io',
            attested: false,
        })

        expect(result.length).toBe(37)
        expect(Array.from(result.slice(0, 32))).toEqual(
            Array.from(expectedDigest),
        )
        expect(result[32]).toBe(0x1d)
        expect(Array.from(result.slice(33, 37))).toEqual([0, 0, 0, 0])
    })

    it('for attestation (attested data included) starts with SHA256(rpId) || 0x5D and has the attested block appended', async () => {
        const expectedDigest = sha256(new TextEncoder().encode('webauthn.io'))
        const publicKeyXY = { x: X, y: Y }
        const attested = attestedCredentialData(CREDENTIAL_ID, publicKeyXY)

        const result = await authenticatorData({
            rpId: 'webauthn.io',
            attested: true,
            credentialId: CREDENTIAL_ID,
            publicKeyXY,
        })

        expect(result.length).toBe(37 + attested.length)
        expect(Array.from(result.slice(0, 32))).toEqual(
            Array.from(expectedDigest),
        )
        expect(result[32]).toBe(0x5d)
        expect(Array.from(result.slice(33, 37))).toEqual([0, 0, 0, 0])
        expect(Array.from(result.slice(37))).toEqual(Array.from(attested))
    })

    it('throws when attested is true but credentialId/publicKeyXY are omitted', async () => {
        await expect(
            authenticatorData({ rpId: 'webauthn.io', attested: true }),
        ).rejects.toThrow(
            'authenticatorData: credentialId and publicKeyXY are required when attested is true',
        )
    })
})

describe('attestationObjectNone', () => {
    it('wraps authData in the CBOR map {"fmt":"none","attStmt":{},"authData":<bytes>} with the 3-pair map prefix', () => {
        const authData = new Uint8Array([0x01, 0x02, 0x03])

        const result = attestationObjectNone(authData)

        expect(result[0]).toBe(0xa3)
        expect(Array.from(result)).toEqual([
            0xa3,
            0x63,
            'f'.charCodeAt(0),
            'm'.charCodeAt(0),
            't'.charCodeAt(0),
            0x64,
            'n'.charCodeAt(0),
            'o'.charCodeAt(0),
            'n'.charCodeAt(0),
            'e'.charCodeAt(0),
            0x67,
            'a'.charCodeAt(0),
            't'.charCodeAt(0),
            't'.charCodeAt(0),
            'S'.charCodeAt(0),
            't'.charCodeAt(0),
            'm'.charCodeAt(0),
            't'.charCodeAt(0),
            0xa0,
            0x68,
            'a'.charCodeAt(0),
            'u'.charCodeAt(0),
            't'.charCodeAt(0),
            'h'.charCodeAt(0),
            'D'.charCodeAt(0),
            'a'.charCodeAt(0),
            't'.charCodeAt(0),
            'a'.charCodeAt(0),
            0x43,
            ...authData,
        ])
    })
})

describe('splitP256PublicKey', () => {
    it('splits a raw 64-byte X||Y key', () => {
        const raw = new Uint8Array([...X, ...Y])

        expect(splitP256PublicKey(raw)).toEqual({ x: X, y: Y })
    })

    it('splits a 65-byte 0x04-prefixed key, dropping the prefix', () => {
        const prefixed = new Uint8Array([0x04, ...X, ...Y])

        expect(splitP256PublicKey(prefixed)).toEqual({ x: X, y: Y })
    })

    it('throws for an invalid key length', () => {
        expect(() => splitP256PublicKey(new Uint8Array(10))).toThrow()
    })
})
