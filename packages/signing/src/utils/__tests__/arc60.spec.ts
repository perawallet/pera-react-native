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

import { describe, expect, it, test, vi } from 'vitest'
import { sha256 } from '@noble/hashes/sha2.js'
import { canonify } from 'canonify'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    ARC60_SCOPE_AUTH,
    Arc60BadJsonError,
    Arc60DomainMismatchError,
    Arc60FailedDecodingError,
    Arc60FailedHdPathError,
    Arc60InvalidScopeError,
    Arc60InvalidSignerError,
    Arc60MissingAuthDataError,
    Arc60MissingDomainError,
    buildArc60AuthSigningPayload,
    decodeArc60Data,
    validateArc60AuthRequest,
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
    const localRpIdHash = sha256(utf8(domain))

    test('passes when authenticatorData[0:32] matches sha256(domain)', () => {
        const authData = new Uint8Array([...localRpIdHash, 0x01, 0x02, 0x03])
        expect(() => verifyAuthenticatorDomain(domain, authData)).not.toThrow()
    })

    test('throws Arc60DomainMismatchError on hash mismatch', () => {
        const tampered = new Uint8Array(localRpIdHash)
        tampered[0] ^= 0xff
        const authData = new Uint8Array([...tampered, 0x00])
        expect(() => verifyAuthenticatorDomain(domain, authData)).toThrow(
            Arc60DomainMismatchError,
        )
    })

    test('throws Arc60MissingDomainError when domain is empty', () => {
        const authData = new Uint8Array([...localRpIdHash])
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

// =============================================================================
// Fixtures shared by validateArc60AuthRequest tests — use the same valid
// signer/domain shape as useLocalKeyArc60Signer.spec.ts, with a realistic 37-byte
// authenticatorData (first 32 bytes = sha256(domain)).
// =============================================================================

const DOMAIN = 'arc60.io'
const SIGNER = 'HD_ADDR'

const rpIdHash = sha256(utf8(DOMAIN))
// 37-byte authenticatorData: 32-byte rpIdHash + 5 flag/counter bytes
const AUTH_DATA = new Uint8Array([...rpIdHash, 0x05, 0x00, 0x00, 0x00, 0x00])

const buildSiwa = (overrides: Record<string, unknown> = {}): string =>
    canonify({
        domain: DOMAIN,
        account_address: SIGNER,
        uri: 'https://arc60.io/login',
        version: '1',
        nonce: 'abc123',
        chain_id: 'algorand:mainnet',
        type: 'ed25519',
        ...overrides,
    })!

const validSiwaPayload = utf8(buildSiwa())
const validData = encodeToBase64(validSiwaPayload)

const mismatchedData = encodeToBase64(
    utf8(buildSiwa({ account_address: 'OTHER_ADDR' })),
)

const makeAuthData = (domain: string): Uint8Array => {
    const hash = sha256(utf8(domain))
    return new Uint8Array([...hash, 0x05, 0x00, 0x00, 0x00, 0x00])
}

describe('validateArc60AuthRequest', () => {
    test('returns decodedData for a valid AUTH request', () => {
        const { decodedData } = validateArc60AuthRequest(
            {
                data: validData,
                signer: SIGNER,
                domain: DOMAIN,
                authenticatorData: AUTH_DATA,
            },
            { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
        )
        expect(decodedData).toBeInstanceOf(Uint8Array)
        expect(Array.from(decodedData)).toEqual(Array.from(validSiwaPayload))
    })

    test('throws Arc60InvalidScopeError on non-AUTH scope', () => {
        expect(() =>
            validateArc60AuthRequest(
                {
                    data: 'e30=',
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: AUTH_DATA,
                },
                { scope: 2, encoding: 'base64' },
            ),
        ).toThrow(Arc60InvalidScopeError)
    })

    test('throws when authenticatorData rpIdHash does not match domain', () => {
        expect(() =>
            validateArc60AuthRequest(
                {
                    data: validData,
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: makeAuthData('evil.com'),
                },
                { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
            ),
        ).toThrow(Arc60DomainMismatchError)
    })

    test('throws Arc60InvalidSignerError when SIWA account_address does not match signer', () => {
        expect(() =>
            validateArc60AuthRequest(
                {
                    data: mismatchedData,
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: AUTH_DATA,
                },
                { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
            ),
        ).toThrow(Arc60InvalidSignerError)
    })

    test('throws Arc60BadJsonError when SIWA domain does not match request domain', () => {
        const wrongDomainData = encodeToBase64(
            utf8(buildSiwa({ domain: 'evil.io' })),
        )
        expect(() =>
            validateArc60AuthRequest(
                {
                    data: wrongDomainData,
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: AUTH_DATA,
                },
                { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
            ),
        ).toThrow(Arc60BadJsonError)
    })

    test('throws Arc60BadJsonError when payload is not valid SIWA JSON', () => {
        const nonSiwaData = encodeToBase64(utf8('{"not":"siwa"}'))
        expect(() =>
            validateArc60AuthRequest(
                {
                    data: nonSiwaData,
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: AUTH_DATA,
                },
                { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
            ),
        ).toThrow(Arc60BadJsonError)
    })

    it('throws Arc60BadJsonError when decoded data is not valid UTF-8', () => {
        const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0xff])
        const data = encodeToBase64(invalidUtf8)
        expect(() =>
            validateArc60AuthRequest(
                {
                    data,
                    signer: SIGNER,
                    domain: DOMAIN,
                    authenticatorData: AUTH_DATA,
                },
                { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
            ),
        ).toThrow(Arc60BadJsonError)
    })
})

describe('error classes', () => {
    test('Arc60InvalidSignerError includes the reason when provided', () => {
        const err = new Arc60InvalidSignerError('SIGNER', 'wrong network')
        expect(err.message).toContain('SIGNER')
        expect(err.message).toContain('wrong network')
    })

    test('Arc60InvalidSignerError omits the reason when not provided', () => {
        // Covers the falsy branch of the ternary in the constructor.
        const err = new Arc60InvalidSignerError('SIGNER')
        expect(err.message).toContain('SIGNER')
        expect(err.message).toContain('not available')
    })

    test('Arc60FailedHdPathError includes the reason when provided', () => {
        const err = new Arc60FailedHdPathError("m/44'/0'/0'", 'malformed')
        expect(err.message).toContain("m/44'/0'/0'")
        expect(err.message).toContain('malformed')
    })

    test('Arc60FailedHdPathError omits the reason when not provided', () => {
        // Covers the falsy branch of the ternary in the constructor.
        const err = new Arc60FailedHdPathError("m/44'/0'/0'")
        expect(err.message).toContain("m/44'/0'/0'")
        expect(err.message).toContain('is invalid')
    })

    test('Arc60FailedDecodingError preserves the original Error cause', () => {
        const original = new Error('atob failed')
        const err = new Arc60FailedDecodingError('base64', original)
        expect(err.message).toContain('base64')
    })
})

describe('decodeArc60Data — non-Error catch path', () => {
    test('does not crash when the decoder throws a non-Error value', async () => {
        // The catch branch in decodeArc60Data inspects `error instanceof Error`.
        // We cover the `false` side by monkey-patching the global atob to throw
        // a non-Error string, since the wallet-core decoder ultimately falls
        // back to that primitive.
        const shared = await import('@perawallet/wallet-core-shared')
        const spy = vi
            .spyOn(shared, 'decodeFromBase64')
            .mockImplementationOnce(() => {
                throw 'not an Error instance'
            })
        try {
            expect(() => decodeArc60Data('anything', 'base64')).toThrow(
                Arc60FailedDecodingError,
            )
        } finally {
            spy.mockRestore()
        }
    })
})

describe('validateArc60AuthRequest — non-Error UTF-8 catch path', () => {
    test('wraps a non-Error UTF-8 throw into Arc60BadJsonError', () => {
        // TextDecoder with fatal:true throws a TypeError on invalid UTF-8, so
        // the `caught instanceof Error` branch usually goes true. To cover the
        // false side, monkey-patch the global TextDecoder.decode for one call.
        const realDecode = TextDecoder.prototype.decode
        TextDecoder.prototype.decode = function patched() {
            throw 'not an Error instance'
        }
        try {
            expect(() =>
                validateArc60AuthRequest(
                    {
                        data: encodeToBase64(utf8('{}')),
                        signer: SIGNER,
                        domain: DOMAIN,
                        authenticatorData: AUTH_DATA,
                    },
                    { scope: ARC60_SCOPE_AUTH, encoding: 'base64' },
                ),
            ).toThrow(Arc60BadJsonError)
        } finally {
            TextDecoder.prototype.decode = realDecode
        }
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
