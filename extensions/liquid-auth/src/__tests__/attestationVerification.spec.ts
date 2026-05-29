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
import {
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { describe, expect, it } from 'vitest'
import {
    createKeystoreCredentialMechanismCore,
    type P256KeyAccess,
} from '../keystoreCredentials'
import { toBase64Url } from '../webauthn'

/**
 * Replicates the EXACT verification the Liquid Auth server performs (it calls
 * `@simplewebauthn/server`'s `verifyRegistrationResponse` /
 * `verifyAuthenticationResponse` and wraps any thrown error into a catch-all
 * `401 "User verification failed"`). Running the real verifier here surfaces
 * the true error and locks the WebAuthn (Path A) round-trip as a regression
 * guard.
 *
 * NOTE on the live 401: this proves Path A (WebAuthn) is correct. If the live
 * server still 401s, the failure is Path B — the custom `liquid` Ed25519
 * extension check (`nacl.sign.detached.verify(challengeBytes, signature,
 * address)`), which is NOT exercised by `@simplewebauthn/server`.
 */
describe('attestation registration verification', () => {
    const expectedRPID = 'example.test'
    const expectedOrigin = 'https://example.test'

    const makeKeyAccess = (): {
        keyAccess: P256KeyAccess
        credentialId: string
    } => {
        const priv = p256.utils.randomPrivateKey()
        const pub = p256.getPublicKey(priv, false) // 0x04 ‖ X(32) ‖ Y(32)
        const x = pub.slice(1, 33)
        const y = pub.slice(33, 65)

        const credentialIdBytes = crypto.getRandomValues(new Uint8Array(20))
        const credentialId = toBase64Url(credentialIdBytes)

        const keyAccess: P256KeyAccess = {
            deriveP256: async () => ({
                keyId: 'k',
                credentialId,
                publicKeyXY: { x, y },
            }),
            getP256: async () => ({ keyId: 'k', publicKeyXY: { x, y } }),
            // WebAuthn signs the pre-hashed payload AS-IS; `prehash: false`.
            signP256: async (_keyId, bytes) =>
                p256.sign(bytes, priv, { prehash: false }).toCompactRawBytes(),
        }
        return { keyAccess, credentialId }
    }

    it('produces an attestation that verifyRegistrationResponse accepts', async () => {
        const { keyAccess } = makeKeyAccess()
        // Use a challenge in the SAME canonical base64url-no-padding form the
        // server's generateRegistrationOptions emits and stores verbatim.
        const challengeBytes = crypto.getRandomValues(new Uint8Array(32))
        const expectedChallenge = toBase64Url(challengeBytes)

        const mechanism = createKeystoreCredentialMechanismCore({
            keyAccess,
            requireUserVerification: async () => true,
        })

        const credential = await mechanism.create({
            rp: { id: expectedRPID },
            user: { name: 'tester', id: 'tester' },
            challenge: expectedChallenge,
        })

        const verification = await verifyRegistrationResponse({
            response: credential as Parameters<
                typeof verifyRegistrationResponse
            >[0]['response'],
            expectedChallenge,
            expectedOrigin,
            expectedRPID,
            // The server omits this, so it defaults to true; our authData sets UV.
            requireUserVerification: true,
        })

        expect(verification.verified).toBe(true)
    })

    it('verifies against a challenge produced by the real server helper', async () => {
        const { keyAccess } = makeKeyAccess()
        // Exactly what the Liquid Auth server stores as session.challenge.
        const options = await generateRegistrationOptions({
            rpName: 'tester',
            rpID: expectedRPID,
            userName: 'tester',
            supportedAlgorithmIDs: [-7],
        })

        const mechanism = createKeystoreCredentialMechanismCore({
            keyAccess,
            requireUserVerification: async () => true,
        })

        const credential = await mechanism.create({
            rp: { id: expectedRPID },
            user: { name: 'tester', id: 'tester' },
            challenge: options.challenge,
        })

        const verification = await verifyRegistrationResponse({
            response: credential as Parameters<
                typeof verifyRegistrationResponse
            >[0]['response'],
            expectedChallenge: options.challenge,
            expectedOrigin,
            expectedRPID,
            requireUserVerification: true,
        })

        expect(verification.verified).toBe(true)
    })

    it('produces an assertion that verifyAuthenticationResponse accepts', async () => {
        const { keyAccess, credentialId } = makeKeyAccess()
        const challengeBytes = crypto.getRandomValues(new Uint8Array(32))
        const expectedChallenge = toBase64Url(challengeBytes)

        const mechanism = createKeystoreCredentialMechanismCore({
            keyAccess,
            requireUserVerification: async () => true,
        })

        // First register so we can hand the verifier the credential public key.
        const created = await mechanism.create({
            rp: { id: expectedRPID },
            user: { name: 'tester', id: 'tester' },
            challenge: expectedChallenge,
        })
        const registration = await verifyRegistrationResponse({
            response: created as Parameters<
                typeof verifyRegistrationResponse
            >[0]['response'],
            expectedChallenge,
            expectedOrigin,
            expectedRPID,
            requireUserVerification: true,
        })
        const cred = registration.registrationInfo?.credential
        expect(cred).toBeDefined()

        const assertion = await mechanism.get({
            rpId: expectedRPID,
            challenge: expectedChallenge,
            allowCredentials: [{ id: credentialId, type: 'public-key' }],
        })

        const verification = await verifyAuthenticationResponse({
            response: assertion as Parameters<
                typeof verifyAuthenticationResponse
            >[0]['response'],
            expectedChallenge,
            expectedOrigin,
            expectedRPID,
            requireUserVerification: true,
            credential: {
                id: cred!.id,
                publicKey: cred!.publicKey,
                counter: cred!.counter,
            },
        })

        expect(verification.verified).toBe(true)
    })
})
