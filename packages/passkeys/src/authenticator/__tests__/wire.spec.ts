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
import {
    b64urlToBytes,
    bufferSourceToBytes,
    bytesToB64url,
    deserializeCreateOptions,
    deserializeCredential,
    deserializeGetOptions,
    serializeCreateOptions,
    serializeCredential,
    serializeGetOptions,
    type RawCredential,
} from '../wire'

// A known 32-byte challenge and its independently-computed base64url form
// (standard base64 `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=`, verified
// against Node's `Buffer.from(...).toString('base64')`, then padding
// stripped and `+/` swapped for `-_`).
const KNOWN_CHALLENGE = Uint8Array.from({ length: 32 }, (_, i) => i)
const KNOWN_CHALLENGE_B64URL = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'

describe('bytesToB64url / b64urlToBytes', () => {
    it('maps a known challenge buffer to the expected base64url string (no padding, standard alphabet swapped)', () => {
        expect(bytesToB64url(KNOWN_CHALLENGE)).toBe(KNOWN_CHALLENGE_B64URL)
        expect(KNOWN_CHALLENGE_B64URL).not.toContain('=')
        expect(KNOWN_CHALLENGE_B64URL).not.toMatch(/[+/]/)
    })

    it('round-trips arbitrary bytes, including ones whose standard-base64 form contains + and /', () => {
        // 0xfb 0xff → standard base64 "+/8=" — exercises both swapped chars and padding stripped.
        const bytes = Uint8Array.from([0xfb, 0xff, 0xff])

        const encoded = bytesToB64url(bytes)

        expect(encoded).not.toMatch(/[+/=]/)
        expect(Array.from(b64urlToBytes(encoded))).toEqual(Array.from(bytes))
    })

    it('decodes an unpadded base64url string of any remainder-2 or remainder-3 length', () => {
        expect(Array.from(b64urlToBytes('_w'))).toEqual([0xff])
        expect(Array.from(b64urlToBytes('_-8'))).toEqual([0xff, 0xef])
    })
})

describe('bufferSourceToBytes', () => {
    it('passes a Uint8Array through unchanged', () => {
        const bytes = Uint8Array.from([1, 2, 3])
        expect(bufferSourceToBytes(bytes)).toBe(bytes)
    })

    it('views an ArrayBuffer as a Uint8Array', () => {
        const buffer = Uint8Array.from([4, 5, 6]).buffer
        expect(Array.from(bufferSourceToBytes(buffer))).toEqual([4, 5, 6])
    })
})

describe('serializeCreateOptions / deserializeCreateOptions', () => {
    it('round-trips every ArrayBuffer-bearing field: challenge, user.id, excludeCredentials[].id', () => {
        const options: PublicKeyCredentialCreationOptions = {
            rp: { id: 'webauthn.io', name: 'WebAuthn.io' },
            user: {
                id: Uint8Array.from([9, 9, 9]).buffer,
                name: 'alice',
                displayName: 'Alice',
            },
            challenge: KNOWN_CHALLENGE.buffer,
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            excludeCredentials: [
                { type: 'public-key', id: Uint8Array.from([1, 2, 3]).buffer },
                { type: 'public-key', id: Uint8Array.from([4, 5, 6]).buffer },
            ],
        }

        const serialized = serializeCreateOptions(options)
        // Every buffer field must be a JSON-safe base64url string.
        expect(typeof serialized.challenge).toBe('string')
        expect(typeof serialized.user.id).toBe('string')
        expect(
            serialized.excludeCredentials?.every(c => typeof c.id === 'string'),
        ).toBe(true)

        const roundTripped = deserializeCreateOptions(serialized)
        expect(Array.from(bufferSourceToBytes(roundTripped.challenge))).toEqual(
            Array.from(KNOWN_CHALLENGE),
        )
        expect(Array.from(bufferSourceToBytes(roundTripped.user.id))).toEqual([
            9, 9, 9,
        ])
        expect(
            roundTripped.excludeCredentials?.map(c =>
                Array.from(bufferSourceToBytes(c.id)),
            ),
        ).toEqual([
            [1, 2, 3],
            [4, 5, 6],
        ])
        expect(roundTripped.rp).toEqual(options.rp)
        expect(roundTripped.user.name).toBe('alice')
        expect(roundTripped.user.displayName).toBe('Alice')
    })

    it('omits optional fields entirely rather than serializing them as undefined/null', () => {
        const options: PublicKeyCredentialCreationOptions = {
            rp: { name: 'WebAuthn.io' },
            user: {
                id: Uint8Array.from([1]).buffer,
                name: 'a',
                displayName: 'A',
            },
            challenge: KNOWN_CHALLENGE.buffer,
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        }

        const serialized = serializeCreateOptions(options)

        expect('excludeCredentials' in serialized).toBe(false)
        expect('timeout' in serialized).toBe(false)
        expect('authenticatorSelection' in serialized).toBe(false)
    })
})

describe('serializeGetOptions / deserializeGetOptions', () => {
    it('round-trips challenge and allowCredentials[].id', () => {
        const options: PublicKeyCredentialRequestOptions = {
            challenge: KNOWN_CHALLENGE.buffer,
            rpId: 'webauthn.io',
            allowCredentials: [
                { type: 'public-key', id: Uint8Array.from([7, 8, 9]).buffer },
            ],
        }

        const roundTripped = deserializeGetOptions(serializeGetOptions(options))

        expect(Array.from(bufferSourceToBytes(roundTripped.challenge))).toEqual(
            Array.from(KNOWN_CHALLENGE),
        )
        expect(roundTripped.rpId).toBe('webauthn.io')
        expect(
            roundTripped.allowCredentials?.map(c =>
                Array.from(bufferSourceToBytes(c.id)),
            ),
        ).toEqual([[7, 8, 9]])
    })
})

describe('serializeCredential / deserializeCredential', () => {
    it('round-trips an attestation (create) credential: rawId, response.clientDataJSON, response.attestationObject', () => {
        const raw: RawCredential = {
            id: Uint8Array.from([1, 2, 3, 4]),
            type: 'public-key',
            response: {
                clientDataJSON: Uint8Array.from([10, 11]),
                attestationObject: Uint8Array.from([20, 21, 22]),
            },
        }

        const serialized = serializeCredential(raw)
        // id and rawId are the same base64url string, per the WebAuthn spec's
        // `credential.id === base64url(credential.rawId)` invariant.
        expect(serialized.id).toBe(serialized.rawId)
        expect('attestationObject' in serialized.response).toBe(true)

        const roundTripped = deserializeCredential(serialized)
        expect(Array.from(roundTripped.id)).toEqual([1, 2, 3, 4])
        expect(roundTripped.response).toEqual(raw.response)
    })

    it('round-trips an assertion (get) credential, including a null userHandle', () => {
        const raw: RawCredential = {
            id: Uint8Array.from([5, 6]),
            type: 'public-key',
            response: {
                clientDataJSON: Uint8Array.from([30]),
                authenticatorData: Uint8Array.from([31, 32]),
                signature: Uint8Array.from([33, 34, 35]),
                userHandle: null,
            },
        }

        const roundTripped = deserializeCredential(serializeCredential(raw))

        expect(roundTripped.response).toEqual(raw.response)
    })
})
