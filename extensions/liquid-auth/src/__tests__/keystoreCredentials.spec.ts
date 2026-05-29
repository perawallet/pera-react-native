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

import { describe, it, expect, vi } from 'vitest'
import { sha256 } from '@noble/hashes/sha256'
import { p256 } from '@noble/curves/p256'
import { createKeystoreCredentialMechanismCore } from '../keystoreCredentials'
import type { P256KeyAccess } from '../keystoreCredentials'
import { fromBase64Url, toBase64Url } from '../webauthn'

const RP_ID = 'debug.liquidauth.com'
const USER_HANDLE = 'alice@example.com'
const CHALLENGE = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])

// Deterministic fake P256 keypair so tests can verify a real ECDSA signature.
const FAKE_PRIVATE_KEY = new Uint8Array(32).fill(7)
const FAKE_PUBLIC_KEY = p256.getPublicKey(FAKE_PRIVATE_KEY, false) // 0x04 || x || y
const FAKE_X = FAKE_PUBLIC_KEY.slice(1, 33)
const FAKE_Y = FAKE_PUBLIC_KEY.slice(33, 65)
const KEY_ID = 'keystore-key-id-123'
const CREDENTIAL_ID = toBase64Url(new TextEncoder().encode(KEY_ID))

const fakeKeyAccess = (
    overrides: Partial<P256KeyAccess> = {},
): P256KeyAccess => ({
    deriveP256: vi.fn(async () => ({
        keyId: KEY_ID,
        credentialId: CREDENTIAL_ID,
        publicKeyXY: { x: FAKE_X, y: FAKE_Y },
    })),
    getP256: vi.fn(async (credentialId: string) =>
        credentialId === CREDENTIAL_ID
            ? { keyId: KEY_ID, publicKeyXY: { x: FAKE_X, y: FAKE_Y } }
            : null,
    ),
    signP256: vi.fn(async (_keyId: string, bytes: Uint8Array) =>
        // Sign the bytes as-is (prehash:false), matching the keystore/dp256.
        p256.sign(bytes, FAKE_PRIVATE_KEY).toCompactRawBytes(),
    ),
    ...overrides,
})

const creationOptions = (wrapped: boolean) => {
    const inner = {
        rp: { id: RP_ID, name: 'Liquid Auth' },
        user: {
            id: toBase64Url(new TextEncoder().encode(USER_HANDLE)),
            name: USER_HANDLE,
            displayName: 'Alice',
        },
        challenge: toBase64Url(CHALLENGE),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    }
    return wrapped ? { publicKey: inner } : inner
}

const requestOptions = (wrapped: boolean) => {
    const inner = {
        rpId: RP_ID,
        challenge: toBase64Url(CHALLENGE),
        allowCredentials: [{ type: 'public-key', id: CREDENTIAL_ID }],
    }
    return wrapped ? { publicKey: inner } : inner
}

describe('keystore credential mechanism — create()', () => {
    it('derives a P256 key and returns a well-formed attestation', async () => {
        const keyAccess = fakeKeyAccess()
        const mech = createKeystoreCredentialMechanismCore({ keyAccess })

        const result = await mech.create(creationOptions(true))

        expect(result.id).toBe(CREDENTIAL_ID)
        expect(result.type).toBe('public-key')
        expect(keyAccess.deriveP256).toHaveBeenCalledWith({
            origin: RP_ID,
            userHandle: USER_HANDLE,
        })

        // clientDataJSON decodes to a webauthn.create payload for our challenge.
        const clientData = JSON.parse(
            new TextDecoder().decode(
                fromBase64Url(result.response.clientDataJSON),
            ),
        )
        expect(clientData.type).toBe('webauthn.create')
        // clientDataJSON.origin carries the full https origin (the server's web
        // expectedOrigin); the bare RP_ID is only used for the rpIdHash.
        expect(clientData.origin).toBe(`https://${RP_ID}`)
        expect(clientData.challenge).toBe(toBase64Url(CHALLENGE))

        // attestationObject is non-empty base64url (CBOR).
        expect(result.response.attestationObject.length).toBeGreaterThan(0)
        expect(result.clientExtensionResults).toEqual({})
    })

    it('accepts bare (non-wrapped) creation options', async () => {
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess: fakeKeyAccess(),
        })
        const result = await mech.create(creationOptions(false))
        expect(result.id).toBe(CREDENTIAL_ID)
    })

    it('awaits the user-verification gate before deriving', async () => {
        const order: string[] = []
        const keyAccess = fakeKeyAccess({
            deriveP256: vi.fn(async () => {
                order.push('derive')
                return {
                    keyId: KEY_ID,
                    credentialId: CREDENTIAL_ID,
                    publicKeyXY: { x: FAKE_X, y: FAKE_Y },
                }
            }),
        })
        const requireUserVerification = vi.fn(async () => {
            order.push('uv')
            return true
        })
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess,
            requireUserVerification,
        })

        await mech.create(creationOptions(true))

        expect(requireUserVerification).toHaveBeenCalledOnce()
        expect(order).toEqual(['uv', 'derive'])
    })

    it('rejects when the user-verification gate denies', async () => {
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess: fakeKeyAccess(),
            requireUserVerification: async () => false,
        })
        await expect(mech.create(creationOptions(true))).rejects.toThrow(
            /user verification/i,
        )
    })
})

describe('keystore credential mechanism — get()', () => {
    it('signs sha256(authData || sha256(clientData)) and returns a DER signature', async () => {
        const keyAccess = fakeKeyAccess()
        const mech = createKeystoreCredentialMechanismCore({ keyAccess })

        const result = await mech.get(requestOptions(true))

        expect(result.id).toBe(CREDENTIAL_ID)
        expect(result.type).toBe('public-key')

        const clientDataBytes = fromBase64Url(result.response.clientDataJSON)
        const clientData = JSON.parse(new TextDecoder().decode(clientDataBytes))
        expect(clientData.type).toBe('webauthn.get')
        expect(clientData.challenge).toBe(toBase64Url(CHALLENGE))

        // The signed payload must be sha256(authData || sha256(clientData)).
        const authData = fromBase64Url(result.response.authenticatorData)
        const clientDataHash = sha256(clientDataBytes)
        const signedPayload = sha256(
            new Uint8Array([...authData, ...clientDataHash]),
        )
        const derSig = fromBase64Url(result.response.signature)
        const verified = p256.verify(
            p256.Signature.fromDER(derSig).toCompactRawBytes(),
            signedPayload,
            FAKE_PUBLIC_KEY,
        )
        expect(verified).toBe(true)

        // signP256 received exactly that 32-byte payload (prehash:false).
        const signCallArgs = (keyAccess.signP256 as ReturnType<typeof vi.fn>)
            .mock.calls[0]
        expect(signCallArgs[0]).toBe(KEY_ID)
        expect(signCallArgs[1]).toEqual(signedPayload)

        // userHandle echoed back, base64url.
        expect(typeof result.response.userHandle).toBe('string')
    })

    it('accepts bare (non-wrapped) request options', async () => {
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess: fakeKeyAccess(),
        })
        const result = await mech.get(requestOptions(false))
        expect(result.id).toBe(CREDENTIAL_ID)
    })

    it('throws when the credential cannot be resolved', async () => {
        const keyAccess = fakeKeyAccess({ getP256: vi.fn(async () => null) })
        const mech = createKeystoreCredentialMechanismCore({ keyAccess })
        await expect(mech.get(requestOptions(true))).rejects.toThrow(
            /no credential/i,
        )
    })

    it('throws when no allowCredentials are provided', async () => {
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess: fakeKeyAccess(),
        })
        await expect(
            mech.get({
                publicKey: { rpId: RP_ID, challenge: toBase64Url(CHALLENGE) },
            }),
        ).rejects.toThrow(/allowCredentials/i)
    })

    it('awaits the user-verification gate before signing', async () => {
        const order: string[] = []
        const keyAccess = fakeKeyAccess({
            signP256: vi.fn(async (_id, bytes) => {
                order.push('sign')
                return p256.sign(bytes, FAKE_PRIVATE_KEY).toCompactRawBytes()
            }),
        })
        const requireUserVerification = vi.fn(async () => {
            order.push('uv')
            return true
        })
        const mech = createKeystoreCredentialMechanismCore({
            keyAccess,
            requireUserVerification,
        })

        await mech.get(requestOptions(true))

        expect(order).toEqual(['uv', 'sign'])
    })
})
