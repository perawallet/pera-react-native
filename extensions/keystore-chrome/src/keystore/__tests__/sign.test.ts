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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 sign.test.ts
// Portions Copyright Algorand Foundation, Apache-2.0
// node:crypto's `subtle` replaced by the web-standard `crypto.subtle` (see
// extensions/keystore-chrome's existing vault/vault.ts convention — this
// package targets the browser, not Node).

import * as bip39 from '@scure/bip39'
import { describe, expect, it } from 'vitest'
import {
    generateEd25519FromSeed,
    generateKey,
    generateSeedData,
    generateXHDRootKeyFromSeed,
} from '../generate'
import {
    signWithKeyData,
    signXHDDomainP256KeyData,
    signXHDEd25519,
} from '../sign'
import type {
    SeedData,
    XHDDerivedKeyData,
    XHDDomainP256KeyData,
} from '../types'

describe('sign.ts', () => {
    const makeUint8 = (arr: number[]) => new Uint8Array(arr)

    async function setupKeys() {
        const seedData = (await generateSeedData({
            strength: 128,
        })) as SeedData

        // Deep clone to prevent original from being cleared
        const rootKey = await generateXHDRootKeyFromSeed({
            ...seedData,
            privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
        })

        const edKey = (await generateKey({
            keyData: {
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                metadata: {
                    account: 0,
                    index: 0,
                    context: 0,
                    parentKeyId: rootKey.id,
                },
            },
            parentKey: {
                ...rootKey,
                privateKey: new Uint8Array(rootKey.privateKey as Uint8Array),
            },
        })) as XHDDerivedKeyData

        const p256Key = (await generateKey({
            keyData: {
                type: 'hd-derived-p256',
                algorithm: 'P256',
                metadata: {
                    origin: 'https://example.com',
                    userHandle: 'user',
                    parentKeyId: rootKey.id,
                },
            },
            parentKey: {
                ...rootKey,
                privateKey: new Uint8Array(rootKey.privateKey as Uint8Array),
            },
        })) as XHDDomainP256KeyData

        return { rootKey, edKey, p256Key, seedData }
    }

    it('signXHDEd25519 signs using real xhd and clears root privateKey', async () => {
        const { rootKey, edKey } = await setupKeys()

        const data = makeUint8([1, 2, 3])
        const sig = await signXHDEd25519({
            key: edKey,
            root: rootKey,
            data,
        })

        expect(sig).toBeDefined()
        expect(sig?.length).toBe(64)
        // root privateKey must be cleared by finally
        expect(rootKey.privateKey).toBeUndefined()

        // Independent verifier: crypto.subtle's Ed25519, not our own
        // verifyWithKeyData (which shares xhd's derivation with signXHDEd25519
        // and so cannot catch a systematic signing error — see Task 7 fix
        // round 1 finding 2). edKey.publicKey is the raw 32-byte Ed25519
        // public key xhd.keyGen derived alongside the private key.
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(edKey.publicKey as Uint8Array),
            { name: 'Ed25519' },
            false,
            ['verify'],
        )
        expect(
            await crypto.subtle.verify(
                { name: 'Ed25519' },
                cryptoKey,
                new Uint8Array(sig),
                new Uint8Array(data),
            ),
        ).toBe(true)
    })

    it('signXHDDomainP256KeyData uses real dp256 and clears root privateKey', async () => {
        const { rootKey, p256Key } = await setupKeys()

        const data = makeUint8([7, 7])
        const sig = await signXHDDomainP256KeyData({
            key: p256Key,
            root: rootKey,
            data,
        })

        expect(sig).toBeDefined()
        // ECDSA P-256 signature length can vary but is usually around 70-72 bytes in DER or 64 in raw
        // The library likely returns raw 64 bytes
        expect(sig?.length).toBe(64)
        expect(rootKey.privateKey).toBeUndefined()
    })

    it('signWithKeyData routes to correct signer for ed25519 and P256', async () => {
        const { rootKey, edKey, p256Key, seedData } = await setupKeys()

        const sig1 = await signWithKeyData({
            key: edKey,
            parentKey: rootKey,
            data: makeUint8([1]),
        })
        expect(sig1?.length).toBe(64)

        // Re-setup keys because rootKey.privateKey was cleared
        const rootKey2 = await generateXHDRootKeyFromSeed({
            ...seedData,
            privateKey: new Uint8Array(seedData.privateKey as Uint8Array),
        })
        // Since generateXHDRootKeyFromSeed generates a random ID, we need to update the key's metadata
        // or manually set the ID.
        ;(rootKey2 as any).id = p256Key.metadata.parentKeyId

        const sig2 = await signWithKeyData({
            key: p256Key,
            parentKey: rootKey2,
            data: makeUint8([2]),
        })
        expect(sig2?.length).toBe(64)
    })

    it('signWithKeyData falls back to subtle for unknown key types', async () => {
        // No privateKey -> the subtle fallback should reject with a clear error
        const key = {
            id: 'k1',
            type: 'unknown',
            algorithm: 'raw',
        } as any
        await expect(
            signWithKeyData({
                key,
                data: makeUint8([1]),
            }),
        ).rejects.toThrow(/private key|WebCrypto|Unsupported/)
    })

    it('signWithKeyData uses subtle fallback to sign with a standalone Ed25519 key', async () => {
        const seedBytes = await bip39.mnemonicToSeed(
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        )
        const key = await generateEd25519FromSeed({
            id: 'seed-sign',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: new Uint8Array(seedBytes),
        } as any)
        const data = makeUint8([10, 20, 30])
        // Re-clone privateKey because signWithKeyData clears it in the finally block
        const sig = await signWithKeyData({
            key: {
                ...key,
                privateKey: new Uint8Array(key.privateKey as Uint8Array),
            },
            data,
        })
        expect(sig.length).toBe(64)

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            new Uint8Array(key.publicKey as Uint8Array),
            { name: 'Ed25519' },
            false,
            ['verify'],
        )
        expect(
            await crypto.subtle.verify(
                { name: 'Ed25519' },
                cryptoKey,
                new Uint8Array(sig),
                new Uint8Array(data),
            ),
        ).toBe(true)
    })

    it('signWithKeyData refuses to sign with a secret-key entry', async () => {
        const key = {
            id: 'k1',
            type: 'secret-key',
            algorithm: 'raw',
            privateKey: new Uint8Array([1, 2, 3]),
        } as any
        await expect(
            signWithKeyData({ key, data: makeUint8([1]) }),
        ).rejects.toThrow(/cannot be used to sign/)
    })

    it('signXHDEd25519 throws if rootKeyId mismatch', async () => {
        const { rootKey, edKey } = await setupKeys()
        const malformedKey = {
            ...edKey,
            metadata: {
                ...edKey.metadata,
                parentKeyId: 'mismatch',
            },
        }

        await expect(
            signXHDEd25519({
                key: malformedKey,
                root: rootKey,
                data: makeUint8([1]),
            }),
        ).rejects.toThrow('Root key does not match key ID')
    })
})
