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

import { describe, expect, it, vi } from 'vitest'
import { sha256 } from '@noble/hashes/sha2'
import { concatBytes } from '@perawallet/wallet-core-shared'
import {
    InvalidStateError,
    NotAllowedError,
    SecurityError,
    assertCredential,
    createCredential,
    deriveCredentialId,
    p256XYToSpkiDer,
    resolveRpId,
    type KeystoreSigner,
} from '../authenticator'
import {
    attestationObjectNone,
    authenticatorData,
    splitP256PublicKey,
} from '../webauthn-structures'
import { b64urlToBytes, bytesToB64url } from '../wire'

const ORIGIN = 'https://webauthn.io'
const RP_ID = 'webauthn.io'
const FAKE_PUBLIC_KEY_XY = new Uint8Array(64).fill(0x03)
const FAKE_RAW_SIGNATURE = new Uint8Array(64).fill(0x04)

type StoredCredential = {
    keyId: string
    credentialId: Uint8Array
    publicKeyXY: Uint8Array
    userHandle: string
}

/**
 * A fake `KeystoreSigner` — no real HD derivation, just enough behavior to
 * exercise `createCredential`/`assertCredential`'s wiring: fixed keypair,
 * credential list seeded per test, signature is an arbitrary fixed 64 bytes
 * (DER-encoding is a pure byte transform, so it doesn't need to be a real
 * ECDSA signature to prove the core signs the right PAYLOAD and DER-encodes
 * whatever `signP256` returns).
 */
const makeFakeSigner = (
    seed: StoredCredential[] = [],
): KeystoreSigner & {
    calls: { createP256Credential: unknown[]; signP256: unknown[] }
} => {
    const stored = [...seed]
    const calls = {
        createP256Credential: [] as unknown[],
        signP256: [] as unknown[],
    }
    return {
        calls,
        createP256Credential: async input => {
            calls.createP256Credential.push(input)
            // Mirrors a real signer persisting the credential: append it to
            // `stored` (keyed by the byte-exact `userHandleOriginalB64Url`,
            // NOT the lossy derivation `userHandle`) so a `create` followed
            // by an `assert`/`list` on the *same* fake signer instance
            // round-trips end-to-end, same as the real keystore adapter.
            stored.push({
                keyId: 'fake-key-1',
                credentialId: deriveCredentialId(FAKE_PUBLIC_KEY_XY),
                publicKeyXY: FAKE_PUBLIC_KEY_XY,
                userHandle: input.userHandleOriginalB64Url,
            })
            return { keyId: 'fake-key-1', publicKeyXY: FAKE_PUBLIC_KEY_XY }
        },
        signP256: async (keyId, data) => {
            calls.signP256.push({ keyId, data })
            return FAKE_RAW_SIGNATURE
        },
        listP256Credentials: async () => stored,
    }
}

describe('resolveRpId', () => {
    it('falls back to the hostname of a scheme-qualified origin when no rpId is supplied', () => {
        expect(resolveRpId(undefined, 'https://webauthn.io')).toBe(
            'webauthn.io',
        )
    })

    it('falls back to the raw string when the origin has no scheme (already a bare domain)', () => {
        expect(resolveRpId(undefined, 'webauthn.io')).toBe('webauthn.io')
    })

    it('accepts an explicit rpId equal to the hostname', () => {
        expect(resolveRpId('webauthn.io', 'https://webauthn.io')).toBe(
            'webauthn.io',
        )
    })

    it('accepts an explicit rpId that is a registrable parent domain of the hostname', () => {
        expect(resolveRpId('example.com', 'https://login.example.com')).toBe(
            'example.com',
        )
    })

    it('accepts an exact-match localhost rpId', () => {
        expect(resolveRpId('localhost', 'http://localhost:3000')).toBe(
            'localhost',
        )
    })

    it('normalizes a mixed-case rpId and a trailing dot (WebAuthn RP IDs are case-insensitive domains)', () => {
        expect(resolveRpId('WebAuthn.IO', 'https://webauthn.io')).toBe(
            'webauthn.io',
        )
        expect(resolveRpId('Example.com', 'https://login.example.com')).toBe(
            'example.com',
        )
        expect(resolveRpId('webauthn.io.', 'https://webauthn.io')).toBe(
            'webauthn.io',
        )
    })

    it('throws SecurityError for an rpId naming an unrelated domain', () => {
        expect(() => resolveRpId('evil.com', 'https://webauthn.io')).toThrow(
            SecurityError,
        )
    })

    it('throws SecurityError for a bare, dot-less rpId that is not the exact hostname (rejects the "hostname ends with .rpId" false positive)', () => {
        // Without the dot-less guard, 'example.com'.endsWith('.com') would
        // wrongly accept this.
        expect(() => resolveRpId('com', 'https://example.com')).toThrow(
            SecurityError,
        )
    })

    it('throws SecurityError when the hostname is merely a suffix-match substring, not a label-boundary parent', () => {
        // 'evilexample.com' ends with 'example.com' as a raw string, but not
        // at a label boundary ('.example.com') — must be rejected.
        expect(() =>
            resolveRpId('example.com', 'https://evilexample.com'),
        ).toThrow(SecurityError)
    })
})

describe('deriveCredentialId', () => {
    it('is SHA256 of the SPKI-DER encoding of the raw public key, not the raw 64 or 65-byte point', () => {
        const expected = sha256(p256XYToSpkiDer(FAKE_PUBLIC_KEY_XY))

        const result = deriveCredentialId(FAKE_PUBLIC_KEY_XY)

        expect(Array.from(result)).toEqual(Array.from(expected))
        expect(Array.from(result)).not.toEqual(
            Array.from(sha256(FAKE_PUBLIC_KEY_XY)),
        )
    })

    it('is identical whether the signer hands back the raw 64-byte point or the 65-byte 0x04-prefixed form', () => {
        const prefixed = Uint8Array.from([0x04, ...FAKE_PUBLIC_KEY_XY])

        expect(Array.from(deriveCredentialId(prefixed))).toEqual(
            Array.from(deriveCredentialId(FAKE_PUBLIC_KEY_XY)),
        )
    })
})

describe('createCredential', () => {
    const baseOptions = (): PublicKeyCredentialCreationOptions => ({
        rp: { id: RP_ID, name: 'WebAuthn.io' },
        user: {
            id: new TextEncoder().encode('alice').buffer,
            name: 'alice',
            displayName: 'Alice',
        },
        challenge: Uint8Array.from([1, 2, 3, 4]).buffer,
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    })

    it('builds clientDataJSON with type webauthn.create, the b64url challenge, and the given origin', async () => {
        const signer = makeFakeSigner()

        const credential = await createCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        const clientData = JSON.parse(
            new TextDecoder().decode(
                b64urlToBytes(
                    (credential.response as { clientDataJSON: string })
                        .clientDataJSON,
                ),
            ),
        )
        expect(clientData).toEqual({
            type: 'webauthn.create',
            challenge: bytesToB64url(Uint8Array.from([1, 2, 3, 4])),
            origin: ORIGIN,
            crossOrigin: false,
        })
    })

    it('passes the lowercased UTF-8 decoding of user.id as the derivation userHandle, the byte-exact base64url original as userHandleOriginalB64Url, and rpId (not the full origin) as the signer rpId', async () => {
        const signer = makeFakeSigner()
        const options = baseOptions()
        const userIdBytes = new TextEncoder().encode('Alice@Example.com')
        options.user.id = userIdBytes.buffer

        await createCredential(options, signer, { origin: ORIGIN })

        expect(signer.calls.createP256Credential).toEqual([
            {
                rpId: RP_ID,
                userHandle: 'alice@example.com',
                userHandleOriginalB64Url: bytesToB64url(userIdBytes),
                displayName: 'Alice',
                userName: 'alice',
            },
        ])
        // The original-bytes field must NOT be lowercased or otherwise
        // lossy — it decodes back to the exact mixed-case input.
        expect(
            new TextDecoder().decode(
                b64urlToBytes(
                    (
                        signer.calls.createP256Credential[0] as {
                            userHandleOriginalB64Url: string
                        }
                    ).userHandleOriginalB64Url,
                ),
            ),
        ).toBe('Alice@Example.com')
    })

    it('threads an opaque, non-UTF-8, mixed-case-b64url user.id through create -> assert unchanged (byte-exact round trip)', async () => {
        const signer = makeFakeSigner()
        const options = baseOptions()
        // Deliberately invalid UTF-8 (lone continuation/invalid start bytes)
        // and not case-normalizable — a webauthn.io-style opaque random
        // handle. The lossy derivation `userHandle` can never reconstruct
        // this; only `userHandleOriginalB64Url` can.
        const opaqueUserId = Uint8Array.from([
            0xff, 0x00, 0xab, 0x10, 0x9a, 0x5c, 0x00, 0x01, 0x7e, 0x3d,
        ])
        options.user.id = opaqueUserId.buffer

        await createCredential(options, signer, { origin: ORIGIN })

        const result = await assertCredential(
            { challenge: Uint8Array.from([9, 9]).buffer, rpId: RP_ID },
            signer,
            { origin: ORIGIN },
        )

        const response = result.response as { userHandle: string | null }
        expect(response.userHandle).not.toBeNull()
        expect(
            Array.from(b64urlToBytes(response.userHandle as string)),
        ).toEqual(Array.from(opaqueUserId))
    })

    it('throws SecurityError (not calling the signer at all) when rp.id names a domain unrelated to the origin', async () => {
        const signer = makeFakeSigner()
        const options = baseOptions()
        options.rp = { id: 'evil.com', name: 'Evil' }

        await expect(
            createCredential(options, signer, { origin: ORIGIN }),
        ).rejects.toThrow(SecurityError)
        expect(signer.calls.createP256Credential).toHaveLength(0)
    })

    it('sets credentialId = SHA256(SPKI-DER(publicKeyXY)) as both id and rawId', async () => {
        const signer = makeFakeSigner()
        const expectedId = bytesToB64url(deriveCredentialId(FAKE_PUBLIC_KEY_XY))

        const credential = await createCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        expect(credential.id).toBe(expectedId)
        expect(credential.rawId).toBe(expectedId)
    })

    it('assembles an attestationObject that independently reconstructs to the same bytes as Task 1s CBOR "none" wrapper', async () => {
        const signer = makeFakeSigner()

        const credential = await createCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        const credentialId = deriveCredentialId(FAKE_PUBLIC_KEY_XY)
        const expectedAuthData = await authenticatorData({
            rpId: RP_ID,
            attested: true,
            credentialId,
            publicKeyXY: splitP256PublicKey(FAKE_PUBLIC_KEY_XY),
        })
        const expectedAttestationObject =
            attestationObjectNone(expectedAuthData)

        const actual = b64urlToBytes(
            (credential.response as { attestationObject: string })
                .attestationObject,
        )
        expect(Array.from(actual)).toEqual(
            Array.from(expectedAttestationObject),
        )
        // Sanity: still the CBOR "none" map (map prefix 0xa3, per Task 1 spec).
        expect(actual[0]).toBe(0xa3)
    })

    it('throws InvalidStateError when excludeCredentials names a credential already stored for this origin', async () => {
        const existingId = Uint8Array.from([9, 9, 9])
        const signer = makeFakeSigner([
            {
                keyId: 'existing',
                credentialId: existingId,
                publicKeyXY: FAKE_PUBLIC_KEY_XY,
                userHandle: bytesToB64url(new TextEncoder().encode('alice')),
            },
        ])
        const options = baseOptions()
        options.excludeCredentials = [
            { type: 'public-key', id: existingId.buffer },
        ]

        await expect(
            createCredential(options, signer, { origin: ORIGIN }),
        ).rejects.toThrow(InvalidStateError)
        // Registration must not proceed past the exclude check.
        expect(signer.calls.createP256Credential).toHaveLength(0)
    })

    it('does not throw when excludeCredentials names an id no stored credential has', async () => {
        const signer = makeFakeSigner([
            {
                keyId: 'existing',
                credentialId: Uint8Array.from([1, 1, 1]),
                publicKeyXY: FAKE_PUBLIC_KEY_XY,
                userHandle: bytesToB64url(new TextEncoder().encode('bob')),
            },
        ])
        const options = baseOptions()
        options.excludeCredentials = [
            { type: 'public-key', id: Uint8Array.from([2, 2, 2]).buffer },
        ]

        await expect(
            createCredential(options, signer, { origin: ORIGIN }),
        ).resolves.toBeDefined()
    })
})

describe('assertCredential', () => {
    const baseOptions = (): PublicKeyCredentialRequestOptions => ({
        challenge: Uint8Array.from([5, 6, 7, 8]).buffer,
        rpId: RP_ID,
    })

    const storedCredential = (
        overrides: Partial<StoredCredential> = {},
    ): StoredCredential => ({
        keyId: 'fake-key-1',
        credentialId: Uint8Array.from([1, 2, 3]),
        publicKeyXY: FAKE_PUBLIC_KEY_XY,
        userHandle: bytesToB64url(new TextEncoder().encode('alice')),
        ...overrides,
    })

    it('signs exactly authenticatorData ‖ SHA256(clientDataJSON) and DER-encodes the result (starts 0x30)', async () => {
        const credential = storedCredential()
        const signer = makeFakeSigner([credential])

        const result = await assertCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        const response = result.response as {
            clientDataJSON: string
            authenticatorData: string
            signature: string
        }
        const expectedAuthData = await authenticatorData({
            rpId: RP_ID,
            attested: false,
        })
        const expectedClientDataHash = sha256(
            b64urlToBytes(response.clientDataJSON),
        )
        const expectedSignedPayload = concatBytes(
            expectedAuthData,
            expectedClientDataHash,
        )

        expect(signer.calls.signP256).toEqual([
            { keyId: credential.keyId, data: expectedSignedPayload },
        ])
        // The core DER-encodes signP256's raw output — a DER sequence always
        // starts with tag 0x30.
        expect(b64urlToBytes(response.signature)[0]).toBe(0x30)
    })

    it('echoes back the resolved credential userHandle, decoded to the original bytes', async () => {
        const credential = storedCredential({
            userHandle: bytesToB64url(new TextEncoder().encode('alice')),
        })
        const signer = makeFakeSigner([credential])

        const result = await assertCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        const response = result.response as { userHandle: string | null }
        expect(response.userHandle).not.toBeNull()
        expect(
            new TextDecoder().decode(
                b64urlToBytes(response.userHandle as string),
            ),
        ).toBe('alice')
    })

    it('resolves the credential named in allowCredentials, ignoring other stored credentials for the origin', async () => {
        const wanted = storedCredential({
            keyId: 'wanted-key',
            credentialId: Uint8Array.from([1, 1, 1]),
        })
        const other = storedCredential({
            keyId: 'other-key',
            credentialId: Uint8Array.from([2, 2, 2]),
        })
        const signer = makeFakeSigner([other, wanted])
        const options = baseOptions()
        options.allowCredentials = [
            { type: 'public-key', id: wanted.credentialId.buffer },
        ]

        await assertCredential(options, signer, { origin: ORIGIN })

        expect(signer.calls.signP256).toEqual([
            { keyId: 'wanted-key', data: expect.any(Uint8Array) },
        ])
    })

    it('throws NotAllowedError when allowCredentials names no credential the origin has', async () => {
        const signer = makeFakeSigner([storedCredential()])
        const options = baseOptions()
        options.allowCredentials = [
            { type: 'public-key', id: Uint8Array.from([255, 255, 255]).buffer },
        ]

        await expect(
            assertCredential(options, signer, { origin: ORIGIN }),
        ).rejects.toThrow(NotAllowedError)
    })

    it('throws NotAllowedError for a discoverable request (no allowCredentials) when the origin has no credentials', async () => {
        const signer = makeFakeSigner([])

        await expect(
            assertCredential(baseOptions(), signer, { origin: ORIGIN }),
        ).rejects.toThrow(NotAllowedError)
    })

    it('falls back to the origins single stored credential for a discoverable request (no allowCredentials)', async () => {
        const only = storedCredential()
        const signer = makeFakeSigner([only])

        const result = await assertCredential(baseOptions(), signer, {
            origin: ORIGIN,
        })

        expect(result.id).toBe(bytesToB64url(only.credentialId))
    })

    it('throws SecurityError (not calling the signer at all) when rpId names a domain unrelated to the origin', async () => {
        const signer = makeFakeSigner([storedCredential()])
        const options = baseOptions()
        options.rpId = 'evil.com'

        await expect(
            assertCredential(options, signer, { origin: ORIGIN }),
        ).rejects.toThrow(SecurityError)
        expect(signer.calls.signP256).toHaveLength(0)
    })
})

// A discoverable ("usernameless") request sends no allowCredentials, so the
// core previously took candidates[0] — signing the user in as an identity
// they never chose, with no indication another existed.
describe('assertCredential with several discoverable credentials', () => {
    const twoCredentials = [
        {
            keyId: 'key-alice',
            credentialId: deriveCredentialId(FAKE_PUBLIC_KEY_XY),
            publicKeyXY: FAKE_PUBLIC_KEY_XY,
            userHandle: 'aGFuZGxlLWE',
            displayName: 'Alice Example',
            userName: 'alice@example.com',
        },
        {
            keyId: 'key-bob',
            credentialId: deriveCredentialId(FAKE_PUBLIC_KEY_XY),
            publicKeyXY: FAKE_PUBLIC_KEY_XY,
            userHandle: 'aGFuZGxlLWI',
            displayName: 'Bob Example',
            userName: 'bob@example.com',
        },
    ]

    const signerWith = (
        credentials: typeof twoCredentials,
    ): KeystoreSigner => ({
        createP256Credential: async () => ({
            keyId: 'unused',
            publicKeyXY: FAKE_PUBLIC_KEY_XY,
        }),
        signP256: async () => FAKE_RAW_SIGNATURE,
        listP256Credentials: async () => credentials,
    })

    const getOptions = {
        challenge: new Uint8Array([1, 2, 3]),
        rpId: 'webauthn.io',
    } as unknown as PublicKeyCredentialRequestOptions

    it('asks which identity to assert, with labels for each', async () => {
        const selectCredential = vi.fn(async () => 'key-bob')

        await assertCredential(getOptions, signerWith(twoCredentials), {
            origin: 'https://webauthn.io',
            selectCredential,
        })

        expect(selectCredential).toHaveBeenCalledWith([
            expect.objectContaining({
                keyId: 'key-alice',
                userName: 'alice@example.com',
            }),
            expect.objectContaining({
                keyId: 'key-bob',
                userName: 'bob@example.com',
            }),
        ])
    })

    it('asserts the chosen credential, not the first', async () => {
        const signer = signerWith(twoCredentials)
        const signP256 = vi.fn(async () => FAKE_RAW_SIGNATURE)

        await assertCredential(
            getOptions,
            { ...signer, signP256 },
            {
                origin: 'https://webauthn.io',
                selectCredential: async () => 'key-bob',
            },
        )

        expect(signP256).toHaveBeenCalledWith('key-bob', expect.anything())
    })

    // Dismissing the picker is a decline. Falling back to the first would be
    // the exact behaviour the picker exists to prevent.
    it('declines when the choice is dismissed', async () => {
        await expect(
            assertCredential(getOptions, signerWith(twoCredentials), {
                origin: 'https://webauthn.io',
                selectCredential: async () => null,
            }),
        ).rejects.toBeInstanceOf(NotAllowedError)
    })

    it('does not ask when there is only one credential', async () => {
        const selectCredential = vi.fn(async () => null)

        await assertCredential(getOptions, signerWith([twoCredentials[0]]), {
            origin: 'https://webauthn.io',
            selectCredential,
        })

        expect(selectCredential).not.toHaveBeenCalled()
    })

    // An RP that named the credential has already made the choice.
    it('does not ask when allowCredentials names one', async () => {
        const selectCredential = vi.fn(async () => null)

        await assertCredential(
            {
                ...getOptions,
                allowCredentials: [
                    {
                        id: deriveCredentialId(FAKE_PUBLIC_KEY_XY),
                        type: 'public-key',
                    },
                ],
            } as unknown as PublicKeyCredentialRequestOptions,
            signerWith(twoCredentials),
            { origin: 'https://webauthn.io', selectCredential },
        )

        expect(selectCredential).not.toHaveBeenCalled()
    })

    // A transport with no UI must keep working rather than being forced to
    // invent a picker.
    it('falls back to the first when no picker is provided', async () => {
        const signP256 = vi.fn(async () => FAKE_RAW_SIGNATURE)

        await assertCredential(
            getOptions,
            { ...signerWith(twoCredentials), signP256 },
            { origin: 'https://webauthn.io' },
        )

        expect(signP256).toHaveBeenCalledWith('key-alice', expect.anything())
    })
})
