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
import { DeterministicP256 } from '@algorandfoundation/dp256'
import {
    createCredential,
    deriveCredentialId,
    type KeystoreSigner,
} from '../authenticator'
import { bytesToB64url } from '../wire'

/**
 * Derivation-parity vector test. This uses `@algorandfoundation/dp256`
 * DIRECTLY — the same library
 * `packages/migrate/src/migrate/passkeys/deriveLegacyPasskeyCredential.ts`
 * and mobile's `CredentialProviderViewController.swift` use — to pin this
 * package's wiring against the shared HD-derivation contract, independent of
 * the fake signer used in `authenticator.spec.ts`.
 *
 * No real device-captured `hd-derived-p256` vector (pubkey + credentialId
 * pulled off an actual iOS/Android build) was found anywhere in this repo to
 * freeze here — grepped for `hd-derived-p256` fixtures/vectors and found
 * none. If one becomes available later, add a third test here asserting
 * `deriveCredentialId(getPurePKBytes(...))` equals it byte-for-byte; until
 * then, the two tests below are the parity evidence this package has.
 */

const dp256 = new DeterministicP256()

// Fixed 32-byte "derived main key" stand-in for a real BIP39-derived root —
// arbitrary but fixed, so the test is a stable, reproducible vector.
const FIXED_ROOT_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)
const ORIGIN = 'webauthn.io'
const USER_HANDLE = 'qwe' // already-lowercased WebAuthn user.id, per the brief's vector

describe('dp256 domain-specific derivation (called directly, no wrapper)', () => {
    it('PROVES: is deterministic — same root/origin/userHandle/counter always yields the same public key', async () => {
        const privateKeyA = await dp256.genDomainSpecificKeyPair(
            FIXED_ROOT_KEY,
            ORIGIN,
            USER_HANDLE,
            0,
        )
        const privateKeyB = await dp256.genDomainSpecificKeyPair(
            FIXED_ROOT_KEY,
            ORIGIN,
            USER_HANDLE,
            0,
        )

        const publicKeyA = dp256.getPurePKBytes(privateKeyA)
        const publicKeyB = dp256.getPurePKBytes(privateKeyB)

        expect(publicKeyA.length).toBe(64)
        expect(Array.from(publicKeyA)).toEqual(Array.from(publicKeyB))
    })

    it('PROVES: a different counter or userHandle derives a different key (the inputs actually participate in derivation)', async () => {
        const base = dp256.getPurePKBytes(
            await dp256.genDomainSpecificKeyPair(
                FIXED_ROOT_KEY,
                ORIGIN,
                USER_HANDLE,
                0,
            ),
        )
        const differentCounter = dp256.getPurePKBytes(
            await dp256.genDomainSpecificKeyPair(
                FIXED_ROOT_KEY,
                ORIGIN,
                USER_HANDLE,
                1,
            ),
        )
        const differentUser = dp256.getPurePKBytes(
            await dp256.genDomainSpecificKeyPair(
                FIXED_ROOT_KEY,
                ORIGIN,
                'other-user',
                0,
            ),
        )

        expect(Array.from(differentCounter)).not.toEqual(Array.from(base))
        expect(Array.from(differentUser)).not.toEqual(Array.from(base))
    })
})

describe('authenticator core wired to a real dp256-backed KeystoreSigner', () => {
    it('PROVES: createCredential.id is SHA256(SPKI-DER(dp256.getPurePKBytes(...))) end-to-end, not just against the fake in authenticator.spec.ts', async () => {
        // Mirrors what the real keystore-chrome adapter does: derive via
        // dp256 against the HD root, return the raw public key. No stubbing
        // of credentialId here — this authenticator computes it.
        const signer: KeystoreSigner = {
            createP256Credential: async ({ rpId, userHandle }) => {
                const privateKey = await dp256.genDomainSpecificKeyPair(
                    FIXED_ROOT_KEY,
                    rpId,
                    userHandle,
                    0,
                )
                return {
                    keyId: 'derived-key',
                    publicKeyXY: dp256.getPurePKBytes(privateKey),
                }
            },
            signP256: async () => new Uint8Array(64),
            listP256Credentials: async () => [],
        }

        const credential = await createCredential(
            {
                rp: { id: ORIGIN, name: 'WebAuthn.io' },
                user: {
                    id: new TextEncoder().encode(USER_HANDLE).buffer,
                    name: USER_HANDLE,
                    displayName: USER_HANDLE,
                },
                challenge: Uint8Array.from([1, 2, 3]).buffer,
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            },
            signer,
            { origin: ORIGIN },
        )

        const expectedPrivateKey = await dp256.genDomainSpecificKeyPair(
            FIXED_ROOT_KEY,
            ORIGIN,
            USER_HANDLE,
            0,
        )
        const expectedPublicKey = dp256.getPurePKBytes(expectedPrivateKey)
        const expectedCredentialId = deriveCredentialId(expectedPublicKey)

        expect(credential.id).toBe(bytesToB64url(expectedCredentialId))
    })
})
