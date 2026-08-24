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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 generate.test.ts
// Portions Copyright Algorand Foundation, Apache-2.0

import {
    BIP32DerivationType,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import * as bip39 from '@scure/bip39'
import { describe, expect, it, vi } from 'vitest'
import {
    generateEd25519FromSeed,
    generateKey,
    generateSecretKey,
    generateSeedData,
    generateXHDFromParent,
    generateXHDRootKeyFromSeed,
} from '../generate'
import type {
    Ed25519KeyData,
    SecretKeyData,
    SeedData,
    XHDDerivedKeyData,
    XHDDomainP256KeyData,
    XHDRootKey,
} from '../types/core'

vi.mock('@algorandfoundation/wallet-provider', () => ({
    generateId: () => 'mocked-id',
    clearBuffer: vi.fn(),
}))

describe('generate.ts', () => {
    it('generateSeedData creates a seed from mnemonic', async () => {
        const seed = (await generateSeedData({
            strength: 128,
        })) as SeedData
        expect(seed.type).toBe('seed')
        expect(seed.id).toBe('mocked-id')
        expect(seed.privateKey).toBeDefined()
        expect(seed.privateKey?.length).toBe(64)
    })

    it('generateXHDRootKeyFromSeed creates a rootKey from seed', async () => {
        const seed = {
            id: 'seed-1',
            type: 'hd-seed' as const,
            privateKey: new Uint8Array(64).fill(1),
            extractable: true,
            algorithm: 'raw' as const,
        } as any
        const rootKey = await generateXHDRootKeyFromSeed(seed)
        expect(rootKey.type).toBe('hd-root-key')
        expect(rootKey.metadata?.rootKeyId).toBe('seed-1')
        // Check that it's a valid 96-byte Ed25519 private key (seed + chain code + public key)
        expect(rootKey.privateKey?.length).toBe(96)
    })

    it('generateXHDFromParent creates a derived ed25519 key', async () => {
        const seedData = (await generateSeedData({
            strength: 128,
            // We can't easily force the mnemonic in generateSeedData without mocking bip39
            // but we can mock bip39 to return our TEST_MNEMONIC or just use the seed directly
        })) as SeedData

        const rootKey = await generateXHDRootKeyFromSeed(seedData)

        const keyData = {
            type: 'hd-derived-ed25519' as const,
            metadata: {
                context: KeyContext.Address,
                account: 0,
                index: 0,
                derivation: BIP32DerivationType.Peikert,
            },
        } as any

        const derived = await generateXHDFromParent({
            key: keyData,
            parentKey: rootKey,
        })
        expect(derived.type).toBe('hd-derived-ed25519')
        expect(derived.metadata.parentKeyId).toBe(rootKey.id)
        expect(derived.publicKey).toBeDefined()
        expect(derived.publicKey?.length).toBe(32)
        expect(
            (derived as XHDDerivedKeyData).metadata.address.algorand,
        ).toBeDefined()
    })

    it('generateKey routes to correct generators', async () => {
        const seedKeyData = {
            type: 'hd-seed' as const,
            algorithm: 'raw' as const,
            extractable: true,
            metadata: {},
        }
        const seed = (await generateKey({ keyData: seedKeyData })) as SeedData
        expect(seed.type).toBe('seed')

        const rootKeyData = {
            type: 'hd-root-key' as const,
            algorithm: 'raw' as const,
            extractable: true,
            metadata: { parentKeyId: 'seed-1' },
        }
        const rootKey = (await generateKey({
            keyData: rootKeyData,
            parentKey: seed,
        })) as XHDRootKey
        expect(rootKey.type).toBe('hd-root-key')

        const p256KeyData = {
            type: 'hd-derived-p256' as const,
            algorithm: 'P256' as const,
            extractable: true,
            metadata: { parentKeyId: rootKey.id },
        }
        const p256Key = await generateKey({
            keyData: p256KeyData,
            parentKey: rootKey,
        })
        expect(p256Key.type).toBe('hd-derived-p256')
        expect(p256Key.algorithm).toBe('P256')
    })

    it('generateKey creates deterministic P256 keys from same seed', async () => {
        const seedPrivateKey = new Uint8Array(64).fill(0x42)
        const seed: SeedData = {
            id: 'seed-1',
            type: 'hd-seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: seedPrivateKey,
            metadata: {},
        } as any

        const generateDeterministicP256 = async (s: SeedData) => {
            const rootKey = (await generateKey({
                keyData: {
                    type: 'hd-root-key',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { parentKeyId: s.id },
                },
                parentKey: s,
            })) as XHDRootKey
            const p256Key = (await generateKey({
                keyData: {
                    type: 'hd-derived-p256',
                    algorithm: 'P256',
                    extractable: true,
                    metadata: {
                        parentKeyId: rootKey.id,
                        origin: 'test.com',
                        userHandle: 'user-1',
                    },
                },
                parentKey: rootKey,
            })) as XHDDomainP256KeyData
            return p256Key
        }

        const key1 = await generateDeterministicP256(seed)
        // Need to provide a fresh copy of seed because generateKey might clear it
        const seed2: SeedData = {
            ...seed,
            privateKey: new Uint8Array(seedPrivateKey),
        }
        const key2 = await generateDeterministicP256(seed2)

        expect(key1.publicKey).toEqual(key2.publicKey)
        expect(key1.privateKey).toEqual(key2.privateKey)
        expect(key1.publicKey).toBeDefined()
    })

    it('generateEd25519FromSeed (from a BIP39-derived seed) produces deterministic 32-byte public/64-byte private keys', async () => {
        const mnemonic =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
        const seedBytes = await bip39.mnemonicToSeed(mnemonic)
        const seed: SeedData = {
            id: 'seed-mnemonic',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: new Uint8Array(seedBytes),
        } as any
        const key = await generateEd25519FromSeed(seed)
        expect(key.type).toBe('ed25519')
        expect(key.algorithm).toBe('EdDSA')
        expect(key.publicKey?.length).toBe(32)
        expect(key.privateKey?.length).toBe(64)
        expect(key.metadata?.parentKeyId).toBe('seed-mnemonic')

        // Deterministic from the same mnemonic-derived seed
        const seed2: SeedData = {
            ...seed,
            privateKey: new Uint8Array(seedBytes),
        }
        const key2 = await generateEd25519FromSeed(seed2)
        expect(key.publicKey).toEqual(key2.publicKey)
    })

    it('generateEd25519FromSeed accepts both seed and hd-seed shapes', async () => {
        const bytes = new Uint8Array(64).fill(0x07)
        const seed: SeedData = {
            id: 'seed-1',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: new Uint8Array(bytes),
        } as any
        const k = await generateEd25519FromSeed(seed)
        expect(k.type).toBe('ed25519')
        expect(k.publicKey?.length).toBe(32)
        expect(k.metadata?.parentKeyId).toBe('seed-1')

        const legacy: SeedData = {
            id: 'seed-2',
            type: 'hd-seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: new Uint8Array(bytes),
        } as any
        const k2 = await generateEd25519FromSeed(legacy)
        expect(k2.publicKey).toEqual(k.publicKey)
    })

    it('generateSecretKey stores arbitrary text verbatim', async () => {
        const key = (await generateSecretKey({
            value: 'hello world',
        })) as SecretKeyData
        expect(key.type).toBe('secret-key')
        expect(key.algorithm).toBe('raw')
        expect(new TextDecoder().decode(key.privateKey!)).toBe('hello world')

        const random = await generateSecretKey()
        expect(random.privateKey?.length).toBe(32)
    })

    it('generateKey routes seed alias and secret-key', async () => {
        const seed = (await generateKey({
            keyData: {
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: {},
            },
        })) as SeedData
        expect(seed.type).toBe('seed')

        const secret = (await generateKey({
            keyData: {
                type: 'secret-key',
                algorithm: 'raw',
                extractable: true,
                metadata: { params: { value: 'abc' } },
            },
        })) as SecretKeyData
        expect(secret.type).toBe('secret-key')
        expect(new TextDecoder().decode(secret.privateKey!)).toBe('abc')
    })

    it('generateKey routes ed25519 + seed parent to generateEd25519FromSeed', async () => {
        const mnemonic =
            'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
        const seedBytes = await bip39.mnemonicToSeed(mnemonic)
        const seed: SeedData = {
            id: 'seed-route',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            privateKey: new Uint8Array(seedBytes),
        } as any
        const key = (await generateKey({
            keyData: {
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: true,
                metadata: {},
            },
            parentKey: seed,
        })) as Ed25519KeyData
        expect(key.type).toBe('ed25519')
        expect(key.publicKey?.length).toBe(32)
        expect(key.metadata?.parentKeyId).toBe('seed-route')
    })

    it('generateKey rejects ed25519 without a seed parent', async () => {
        await expect(
            generateKey({
                keyData: {
                    type: 'ed25519',
                    algorithm: 'EdDSA',
                    extractable: true,
                    metadata: {},
                },
            }),
        ).rejects.toThrow(/seed parent/)
    })

    it('generateKey falls back to WebCrypto subtle for unknown algorithms', async () => {
        const key = await generateKey({
            keyData: {
                type: 'ecc',
                algorithm: 'ECDSA',
                extractable: true,
                keyUsages: ['sign', 'verify'],
                metadata: { params: { namedCurve: 'P-256' } },
            },
        })
        expect(key.algorithm).toBe('ECDSA')
        expect(key.privateKey).toBeDefined()
        expect(key.publicKey).toBeDefined()
        expect(key.metadata?.subtle).toBe(true)
    })
})
