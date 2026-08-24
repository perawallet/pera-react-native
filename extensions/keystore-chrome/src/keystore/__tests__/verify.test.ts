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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 verify.test.ts
// Portions Copyright Algorand Foundation, Apache-2.0

import { sha256 } from '@noble/hashes/sha2.js'
import { describe, expect, it } from 'vitest'
import { generateKey } from '../generate'
import { signWithKeyData, signXHDDomainP256KeyData } from '../sign'
import type { KeyData, SeedData, XHDRootKey } from '../types'
import { verifyWithKeyData } from '../verify'

describe('verify.ts', () => {
    const makeUint8 = (arr: number[]) => new Uint8Array(arr)

    async function setupKeys() {
        const seedPrivateKey = new Uint8Array(64).fill(0x42)
        const seed: SeedData = {
            id: 'seed-1',
            type: 'hd-seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: seedPrivateKey,
            metadata: {},
        }

        const rootKey = (await generateKey({
            keyData: {
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: true,
                metadata: { parentKeyId: seed.id },
            },
            parentKey: seed,
        })) as XHDRootKey

        const ed25519Key = await generateKey({
            keyData: {
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: true,
                metadata: {
                    parentKeyId: rootKey.id,
                    context: 1,
                    account: 1,
                    index: 1,
                },
            },
            parentKey: {
                ...rootKey,
                privateKey: new Uint8Array(rootKey.privateKey!),
            } as any,
        })

        const p256Key = await generateKey({
            keyData: {
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: true,
                metadata: {
                    parentKeyId: rootKey.id,
                    origin: 'example.com',
                    userHandle: 'user-123',
                    counter: 0,
                },
            },
            parentKey: {
                ...rootKey,
                privateKey: new Uint8Array(rootKey.privateKey!),
            } as any,
        })

        return { rootKey, ed25519Key, p256Key }
    }

    it('verifyWithKeyData (EdDSA path) verifies real signature', async () => {
        const { rootKey, ed25519Key } = await setupKeys()
        const data = makeUint8([1, 2, 3, 4])

        // We need to clone the key because signing clears it
        const keyToSign = JSON.parse(JSON.stringify(ed25519Key))
        keyToSign.publicKey = new Uint8Array(ed25519Key.publicKey!)
        const rootToSign = JSON.parse(JSON.stringify(rootKey))
        rootToSign.privateKey = new Uint8Array(rootKey.privateKey!)

        const signature = await signWithKeyData({
            key: keyToSign,
            parentKey: rootToSign,
            data,
        })

        const ok = await verifyWithKeyData({
            key: ed25519Key,
            data,
            signature,
        })
        expect(ok).toBe(true)
    })

    it('verifyWithKeyData (P256 path) verifies signature', async () => {
        const { rootKey, p256Key } = await setupKeys()
        const data = makeUint8([1, 2, 3, 4])

        // We need to clone the keys because signing clears them
        const keyToSign = JSON.parse(JSON.stringify(p256Key))
        keyToSign.publicKey = new Uint8Array(p256Key.publicKey!)
        const rootToSign = JSON.parse(JSON.stringify(rootKey))
        rootToSign.privateKey = new Uint8Array(rootKey.privateKey!)

        const signature = await signWithKeyData({
            key: keyToSign,
            parentKey: rootToSign,
            data,
        })

        const ok = await verifyWithKeyData({
            key: p256Key,
            data,
            signature,
        })
        // This is `false`, not a bug in this port: sign.ts's dp256 path signs
        // its input as an already-computed digest (no hashing), while
        // verify.ts's crypto.subtle path hashes the message itself before
        // verifying. The two halves are mutually incompatible upstream, in
        // both canary.17 and the currently-installed production engine — see
        // the next test for a mechanism-level proof, and
        // src/webauthn/keystore-signer.ts:258-269 for the same trap
        // documented at the call site that actually caught it in prod.
        expect(ok).toBe(false)
    })

    it('verifyWithKeyData (P256 path) proves the sign/verify hash mismatch: signing the digest verifies, signing the message does not', async () => {
        const { rootKey, p256Key } = await setupKeys()
        const data = makeUint8([1, 2, 3, 4])
        const digest = sha256(data)

        const keyToSign = JSON.parse(JSON.stringify(p256Key))
        keyToSign.publicKey = new Uint8Array(p256Key.publicKey!)
        const rootToSign = JSON.parse(JSON.stringify(rootKey))
        rootToSign.privateKey = new Uint8Array(rootKey.privateKey!)

        // dp256.signWithDomainSpecificKeyPair (sign.ts:173) does not hash its
        // input — sign the SHA-256 digest directly so it lines up with what
        // crypto.subtle.verify({ hash: 'SHA-256' }) computes internally from
        // the *original* message.
        const signature = await signXHDDomainP256KeyData({
            key: keyToSign,
            root: rootToSign,
            data: digest,
        })

        const ok = await verifyWithKeyData({
            key: p256Key,
            data,
            signature,
        })
        expect(ok).toBe(true)
    })

    it('verifyWithKeyData throws if no public key', async () => {
        const key: KeyData = {
            id: 'k4',
            type: 'ecc',
            algorithm: 'EdDSA',
            extractable: true,
        } as any
        await expect(
            verifyWithKeyData({
                key,
                data: makeUint8([1]),
                signature: makeUint8([2]),
            }),
        ).rejects.toThrow('Key does not have a public key')
    })

    it('verifyWithKeyData throws if algorithm not supported', async () => {
        const key: KeyData = {
            id: 'k5',
            type: 'ecc',
            algorithm: 'UNKNOWN',
            extractable: true,
            publicKey: makeUint8([1]),
        } as any
        await expect(
            verifyWithKeyData({
                key,
                data: makeUint8([1]),
                signature: makeUint8([2]),
            }),
        ).rejects.toThrow('Algorithm UNKNOWN is not supported for verification')
    })
})
