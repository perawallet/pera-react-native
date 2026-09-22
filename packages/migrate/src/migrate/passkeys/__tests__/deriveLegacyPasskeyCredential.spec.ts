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
import { createPublicKey } from 'node:crypto'
import { sha256 } from '@noble/hashes/sha2.js'
import { describe, it, expect, beforeAll } from 'vitest'
import {
    credentialIdBytesToStandardBase64,
    decodeCredentialIdToBytes,
    deriveLegacyPasskeyCredentialFromMainKey,
    deriveMainKey,
    p256RawPublicKeyToSpkiDer,
} from '../deriveLegacyPasskeyCredential'

// Canonical all-zero-entropy BIP39 mnemonic — valid, so dp256 accepts it.
const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const b64UrlToBytes = (b64url: string): Uint8Array =>
    Uint8Array.from(Buffer.from(b64url, 'base64url'))

// deriveMainKey runs a 210k-iteration PBKDF2 (seconds of CPU); derive it once
// and share it across tests rather than paying per test.
let sharedMainKey: Uint8Array

beforeAll(async () => {
    sharedMainKey = await deriveMainKey(TEST_MNEMONIC)
})

describe('p256RawPublicKeyToSpkiDer', () => {
    it('wraps a raw 64-byte point into a 91-byte SPKI that Node can parse', () => {
        const pubRaw = new Uint8Array(64)
        for (let i = 0; i < 64; i += 1) pubRaw[i] = (i * 7 + 1) & 0xff

        const der = p256RawPublicKeyToSpkiDer(pubRaw)

        expect(der).toHaveLength(91)
        // 0x04 uncompressed-point indicator sits right after the 26-byte prefix.
        expect(der[26]).toBe(0x04)
        expect(Array.from(der.slice(0, 4))).toEqual([0x30, 0x59, 0x30, 0x13])
        expect(Array.from(der.slice(27))).toEqual(Array.from(pubRaw))
    })

    it('encodes the exact curve point (round-trips through Node SPKI import)', async () => {
        // Use a real derived public point so x/y are valid curve coordinates.
        const derivedMainKey = sharedMainKey
        const { publicKeySpkiDer } =
            await deriveLegacyPasskeyCredentialFromMainKey({
                derivedMainKey,
                origin: 'webauthn.io',
                userName: 'qwe',
            })

        const key = createPublicKey({
            key: Buffer.from(publicKeySpkiDer),
            format: 'der',
            type: 'spki',
        })
        const jwk = key.export({ format: 'jwk' }) as {
            crv: string
            x: string
            y: string
        }

        expect(jwk.crv).toBe('P-256')
        const x = b64UrlToBytes(jwk.x)
        const y = b64UrlToBytes(jwk.y)
        // The DER's embedded point (bytes after 0x04) is x||y.
        expect(Array.from(publicKeySpkiDer.slice(27, 59))).toEqual(
            Array.from(x),
        )
        expect(Array.from(publicKeySpkiDer.slice(59, 91))).toEqual(
            Array.from(y),
        )
    })
})

describe('deriveMainKey', () => {
    it('matches dp256 genDerivedMainKeyWithBIP39 byte-for-byte (off-thread path)', () => {
        // Frozen output of `dp256.genDerivedMainKeyWithBIP39(TEST_MNEMONIC)` —
        // dp256's reference path is a synchronous 210k-iteration PBKDF2 in pure JS
        // (slow), so we assert the off-thread deriveMainKey against its captured
        // result instead of re-running it every test.
        const DP256_MAIN_KEY_HEX =
            '80ec8c0fc085095e052d18e461bd46d792d37c4d4e0e4b25f3a9b49650bf8af7' +
            'e3760656b3ca62ad50c9a2b64115a205e16bc27712ba76db014d06ed4ac31670'

        expect(Buffer.from(sharedMainKey).toString('hex')).toBe(
            DP256_MAIN_KEY_HEX,
        )
        expect(sharedMainKey).toHaveLength(64)
    })
})

describe('deriveLegacyPasskeyCredentialFromMainKey', () => {
    it('produces a 32-byte private scalar, 91-byte SPKI and SHA256-based id', async () => {
        const derivedMainKey = sharedMainKey

        const result = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
        })

        expect(result.privateKey).toHaveLength(32)
        expect(result.publicKeySpkiDer).toHaveLength(91)
        // credentialId is the standard-base64 SHA256 of the SPKI DER.
        expect(result.credentialIdBytes).toEqual(
            sha256(result.publicKeySpkiDer),
        )
        expect(result.credentialId).toBe(
            Buffer.from(result.credentialIdBytes).toString('base64'),
        )
    })

    it('hashes the raw 64-byte point for the iOS "raw-point" basis', async () => {
        const result = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey: sharedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
            credentialIdBasis: 'raw-point',
        })

        const rawPoint = result.publicKeySpkiDer.slice(27)
        expect(rawPoint).toHaveLength(64)
        expect(result.credentialIdBytes).toEqual(sha256(rawPoint))
        expect(Array.from(result.credentialIdBytes)).not.toEqual(
            Array.from(sha256(result.publicKeySpkiDer)),
        )
    })

    it('reproduces a real Swift dp256 + CryptoKit iOS credentialId (golden vector)', async () => {
        // Golden vector from deterministicP256-swift + CryptoKit (the exact path
        // legacy pera-ios `PassKeyService.dp256KeyPair` uses): TEST_MNEMONIC,
        // origin "webauthn.io", userHandle "qwe", id = SHA256(rawRepresentation).
        const SWIFT_RAW_POINT_HEX =
            'e6936523f4e06bc4025f6ffed4cc5a235e885b65b512033cc203f14ccb686216' +
            '135e988b680806ec76b4dd973fc38148455c55f99ef01dd493319a90407b0680'
        const SWIFT_IOS_CREDENTIAL_ID =
            'fhcC2I3h6VU84rIJg1eZjn8evvexMPiuoDQkxq/XruM='

        const result = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey: sharedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
            credentialIdBasis: 'raw-point',
        })

        // The raw point (CryptoKit rawRepresentation) is the 64 bytes after 0x04.
        expect(
            Buffer.from(result.publicKeySpkiDer.slice(27)).toString('hex'),
        ).toBe(SWIFT_RAW_POINT_HEX)
        expect(result.credentialId).toBe(SWIFT_IOS_CREDENTIAL_ID)
    })

    it('defaults to the Android SPKI-DER basis when none is given', async () => {
        const result = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey: sharedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
        })

        expect(result.credentialIdBytes).toEqual(
            sha256(result.publicKeySpkiDer),
        )
    })

    it('is deterministic for the same inputs', async () => {
        const a = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey: sharedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
        })
        const b = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey: sharedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
        })

        expect(a.credentialId).toBe(b.credentialId)
        expect(Array.from(a.privateKey)).toEqual(Array.from(b.privateKey))
    })

    it('derives a different credential per origin and per userName', async () => {
        const derivedMainKey = sharedMainKey
        const base = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey,
            origin: 'webauthn.io',
            userName: 'qwe',
        })
        const otherOrigin = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey,
            origin: 'example.com',
            userName: 'qwe',
        })
        const otherUser = await deriveLegacyPasskeyCredentialFromMainKey({
            derivedMainKey,
            origin: 'webauthn.io',
            userName: 'asd',
        })

        expect(base.credentialId).not.toBe(otherOrigin.credentialId)
        expect(base.credentialId).not.toBe(otherUser.credentialId)
    })
})

describe('decodeCredentialIdToBytes', () => {
    const digest = sha256(new Uint8Array([1, 2, 3]))

    it('decodes standard base64', () => {
        const encoded = Buffer.from(digest).toString('base64')
        expect(decodeCredentialIdToBytes(encoded)).toEqual(digest)
    })

    it('decodes url-safe base64', () => {
        const encoded = Buffer.from(digest).toString('base64url')
        expect(decodeCredentialIdToBytes(encoded)).toEqual(digest)
    })

    it('decodes lowercase hex', () => {
        const encoded = Buffer.from(digest).toString('hex')
        expect(decodeCredentialIdToBytes(encoded)).toEqual(digest)
    })

    it('returns null for input that is not a 32-byte digest', () => {
        expect(decodeCredentialIdToBytes('not-a-real-id')).toBeNull()
        expect(decodeCredentialIdToBytes('')).toBeNull()
    })
})

describe('helpers', () => {
    it('credentialIdBytesToStandardBase64 emits padded standard base64', () => {
        const bytes = new Uint8Array(32).fill(0xab)
        const encoded = credentialIdBytesToStandardBase64(bytes)
        expect(encoded).toBe(Buffer.from(bytes).toString('base64'))
        expect(encoded.endsWith('=')).toBe(true)
    })
})
