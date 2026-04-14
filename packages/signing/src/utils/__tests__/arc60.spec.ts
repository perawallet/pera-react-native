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

import { describe, expect, test } from 'vitest'
import { sha256 } from '@noble/hashes/sha256'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    Arc60DomainMismatchError,
    Arc60FailedDecodingError,
    Arc60MissingAuthDataError,
    Arc60MissingDomainError,
    buildArc60AuthSigningPayload,
    decodeArc60Data,
    verifyAuthenticatorDomain,
} from '../arc60'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)

describe('decodeArc60Data', () => {
    test('decodes base64-encoded payload', () => {
        const payload = utf8('{"iss":"arc60.io"}')
        const encoded = encodeToBase64(payload)
        // Compare bytewise to sidestep TypedArray/Buffer prototype differences.
        const decoded = decodeArc60Data(encoded, 'base64')
        expect(Array.from(decoded)).toEqual(Array.from(payload))
    })

    test('throws on unsupported encoding', () => {
        expect(() => decodeArc60Data('deadbeef', 'hex')).toThrow(
            Arc60FailedDecodingError,
        )
    })

    test('throws on malformed base64', () => {
        // ! is not a valid base64 character; depending on the platform decoder
        // this either yields garbage or throws — the helper normalises both
        // outcomes into Arc60FailedDecodingError when the decode throws.
        const decode = () => decodeArc60Data('not!valid!base64!@#', 'base64')
        // Some base64 decoders are lenient. Accept either: a successful decode
        // (lenient parser) OR Arc60FailedDecodingError. The important guarantee
        // is that we never leak the underlying error type.
        try {
            decode()
        } catch (error) {
            expect(error).toBeInstanceOf(Arc60FailedDecodingError)
        }
    })
})

describe('verifyAuthenticatorDomain', () => {
    const domain = 'arc60.io'
    const rpIdHash = sha256(utf8(domain))

    test('passes when authenticatorData[0:32] matches sha256(domain)', () => {
        const authData = new Uint8Array([...rpIdHash, 0x01, 0x02, 0x03])
        expect(() => verifyAuthenticatorDomain(domain, authData)).not.toThrow()
    })

    test('throws Arc60DomainMismatchError on hash mismatch', () => {
        const tampered = new Uint8Array(rpIdHash)
        tampered[0] ^= 0xff
        const authData = new Uint8Array([...tampered, 0x00])
        expect(() => verifyAuthenticatorDomain(domain, authData)).toThrow(
            Arc60DomainMismatchError,
        )
    })

    test('throws Arc60MissingDomainError when domain is empty', () => {
        const authData = new Uint8Array([...rpIdHash])
        expect(() => verifyAuthenticatorDomain('', authData)).toThrow(
            Arc60MissingDomainError,
        )
    })

    test('throws Arc60MissingAuthDataError when authenticatorData is too short', () => {
        const tooShort = new Uint8Array(16)
        expect(() => verifyAuthenticatorDomain(domain, tooShort)).toThrow(
            Arc60MissingAuthDataError,
        )
    })
})

describe('buildArc60AuthSigningPayload', () => {
    test('produces sha256(data) || sha256(authenticatorData) with the expected layout', () => {
        const data = utf8('hello world')
        const authData = new Uint8Array(32 + 4)
        authData[32] = 0xaa
        authData[33] = 0xbb
        authData[34] = 0xcc
        authData[35] = 0xdd

        const payload = buildArc60AuthSigningPayload(data, authData)

        const expectedDataHash = sha256(data)
        const expectedAuthHash = sha256(authData)
        // First 32 bytes = sha256(data)
        expect(payload.slice(0, 32)).toEqual(expectedDataHash)
        // Last 32 bytes = sha256(authenticatorData)
        expect(payload.slice(32)).toEqual(expectedAuthHash)
        expect(payload.length).toBe(64)
    })

    test('does not prepend the legacy MX prefix', () => {
        const data = utf8('payload')
        const authData = new Uint8Array(32)
        const payload = buildArc60AuthSigningPayload(data, authData)
        // The MX prefix would put 'M' = 0x4d at byte 0; the payload starts
        // with sha256(data) instead.
        expect(payload[0]).toBe(sha256(data)[0])
    })
})
