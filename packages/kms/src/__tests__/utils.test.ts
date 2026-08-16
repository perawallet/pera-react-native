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

import { describe, test, expect, vi } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    encodeAddress: (bytes: Uint8Array) =>
        `ADDR_${Buffer.from(bytes).toString('hex')}`,
}))

import {
    aclOf,
    algo25AddressOf,
    buildSeedMetadata,
    createdAtOf,
    entropyChildIdOf,
    entropyChildMetadata,
    expiresAtOf,
    hexToBytes,
    isSeedKey,
    seedSchemeOf,
} from '../utils'
import { AccessControlPermission } from '../models'
import { QUANTUM_SEED_LENGTH, SeedScheme } from '../constants'

const seedKey = (
    overrides: Partial<Key> & { metadata?: Record<string, unknown> } = {},
): Key => ({
    id: 'wallet-1',
    type: 'seed',
    algorithm: 'raw',
    extractable: true,
    ...overrides,
})

describe('seedSchemeOf', () => {
    test('returns "bip39" for a seed with scheme=bip39 metadata', () => {
        expect(
            seedSchemeOf(seedKey({ metadata: { scheme: SeedScheme.Bip39 } })),
        ).toBe(SeedScheme.Bip39)
    })

    test('returns "algo25" for a seed with scheme=algo25 metadata', () => {
        expect(
            seedSchemeOf(seedKey({ metadata: { scheme: SeedScheme.Algo25 } })),
        ).toBe(SeedScheme.Algo25)
    })

    test('returns "quantum" for a seed with scheme=quantum metadata', () => {
        expect(
            seedSchemeOf(seedKey({ metadata: { scheme: SeedScheme.Quantum } })),
        ).toBe(SeedScheme.Quantum)
    })

    test('returns "bip39" for an XHD root key', () => {
        const rootKey = seedKey({
            type: 'hd-root-key',
            metadata: { scheme: SeedScheme.Bip39 },
        })

        expect(seedSchemeOf(rootKey)).toBe(SeedScheme.Bip39)
        expect(isSeedKey(rootKey)).toBe(true)
    })

    test('returns null for a seed with no scheme metadata', () => {
        expect(seedSchemeOf(seedKey())).toBeNull()
    })

    test('returns null for an unknown scheme value', () => {
        expect(
            seedSchemeOf(seedKey({ metadata: { scheme: 'frobnicate' } })),
        ).toBeNull()
    })

    test('returns null for non-seed types (hd-derived-ed25519, secret-key, etc.)', () => {
        expect(
            seedSchemeOf({
                id: 'derived-1',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                metadata: { scheme: SeedScheme.Bip39 },
            }),
        ).toBeNull()
        expect(
            seedSchemeOf({
                id: 'pin',
                type: 'secret-key',
                algorithm: 'raw',
                extractable: true,
            }),
        ).toBeNull()
    })

    test('accepts the legacy hd-seed type for backward compatibility', () => {
        expect(
            seedSchemeOf({
                id: 'wallet-1',
                type: 'hd-seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: SeedScheme.Bip39 },
            }),
        ).toBe(SeedScheme.Bip39)
    })
})

describe('isSeedKey', () => {
    test('mirrors seedSchemeOf — true iff a recognised scheme is present', () => {
        expect(
            isSeedKey(seedKey({ metadata: { scheme: SeedScheme.Bip39 } })),
        ).toBe(true)
        expect(isSeedKey(seedKey())).toBe(false)
    })

    test('treats a quantum seed as a wallet-root seed', () => {
        expect(
            isSeedKey(seedKey({ metadata: { scheme: SeedScheme.Quantum } })),
        ).toBe(true)
    })
})

describe('algo25AddressOf', () => {
    test('encodes the publicKey bytes for an algo25 seed', () => {
        const key = seedKey({
            metadata: { scheme: SeedScheme.Algo25 },
            publicKey: new Uint8Array([1, 2, 3]),
        })
        expect(algo25AddressOf(key)).toBe('ADDR_010203')
    })

    test('returns "" for a bip39 seed (no single address)', () => {
        const key = seedKey({
            metadata: { scheme: SeedScheme.Bip39 },
            publicKey: new Uint8Array([1, 2, 3]),
        })
        expect(algo25AddressOf(key)).toBe('')
    })

    test('returns "" when an algo25 seed lacks a publicKey on its reactive snapshot', () => {
        const key = seedKey({ metadata: { scheme: SeedScheme.Algo25 } })
        expect(algo25AddressOf(key)).toBe('')
    })
})

describe('aclOf / createdAtOf / expiresAtOf', () => {
    test('round-trips acl, createdAt, expiresAt through buildSeedMetadata', () => {
        const createdAt = new Date('2025-06-01T12:00:00Z')
        const expiresAt = new Date('2025-12-01T12:00:00Z')
        const acl = [
            {
                domains: ['backup-flow'],
                permissions: [AccessControlPermission.ReadPrivate],
            },
        ]

        const key = seedKey({
            metadata: buildSeedMetadata({
                scheme: SeedScheme.Bip39,
                acl,
                createdAt,
                expiresAt,
            }),
        })

        expect(aclOf(key)).toEqual(acl)
        expect(createdAtOf(key).toISOString()).toBe(createdAt.toISOString())
        expect(expiresAtOf(key)?.toISOString()).toBe(expiresAt.toISOString())
    })

    test('aclOf defaults to the wallet own-origin ACL when pera metadata is absent', () => {
        // Fail-closed default: no explicit ACL means "scoped to the wallet's
        // own signing/backup origins", not allow-all.
        expect(aclOf(seedKey())).toEqual([
            {
                domains: ['pera.accounts', 'backup-flow'],
                permissions: ['read-private'],
            },
        ])
    })

    test('createdAtOf defaults to "now" when pera metadata is absent', () => {
        const before = Date.now()
        expect(createdAtOf(seedKey()).getTime()).toBeGreaterThanOrEqual(before)
    })

    test('expiresAtOf returns undefined when expiresAt is not stamped', () => {
        const key = seedKey({
            metadata: buildSeedMetadata({ scheme: SeedScheme.Bip39 }),
        })
        expect(expiresAtOf(key)).toBeUndefined()
    })

    test('aclOf gives a quantum seed the same fail-closed default ACL as algo25', () => {
        const quantumSeed = seedKey({
            metadata: { scheme: SeedScheme.Quantum, pera: {} },
        })
        const acl = aclOf(quantumSeed)
        expect(acl).toHaveLength(1)
        expect(acl[0].domains).toEqual(['pera.accounts', 'backup-flow'])
        expect(acl[0].permissions).toEqual([
            AccessControlPermission.ReadPrivate,
        ])
    })
})

describe('buildSeedMetadata', () => {
    test('serializes Date fields to ISO strings under the pera namespace', () => {
        const createdAt = new Date('2025-01-01T00:00:00Z')
        const expiresAt = new Date('2026-01-01T00:00:00Z')

        const meta = buildSeedMetadata({
            scheme: SeedScheme.Bip39,
            createdAt,
            expiresAt,
        })

        expect(meta.scheme).toBe(SeedScheme.Bip39)
        expect(meta.pera?.createdAt).toBe('2025-01-01T00:00:00.000Z')
        expect(meta.pera?.expiresAt).toBe('2026-01-01T00:00:00.000Z')
    })

    test('defaults createdAt to now() when not provided', () => {
        const before = Date.now()
        const meta = buildSeedMetadata({ scheme: SeedScheme.Algo25 })
        const created = new Date(meta.pera!.createdAt!).getTime()
        expect(created).toBeGreaterThanOrEqual(before)
    })

    test('never stores entropy in the metadata, even for a bip39 seed', () => {
        const meta = buildSeedMetadata({ scheme: SeedScheme.Bip39 })
        expect('entropy' in meta).toBe(false)
    })
})

describe('entropyChildMetadata', () => {
    test('stamps parentKeyId and the entropyKey marker', () => {
        expect(entropyChildMetadata('seed-123')).toEqual({
            parentKeyId: 'seed-123',
            entropyKey: true,
        })
    })
})

describe('entropyChildIdOf', () => {
    const keys = [
        { id: 'seed-123', type: 'seed', metadata: { scheme: 'bip39' } },
        {
            id: 'random-child-id',
            type: 'secret-key',
            metadata: entropyChildMetadata('seed-123'),
        },
        {
            id: 'derived',
            type: 'hd-derived-ed25519',
            metadata: { parentKeyId: 'seed-123' },
        },
    ] as unknown as Key[]

    test('finds the entropy child by its metadata, regardless of id', () => {
        expect(entropyChildIdOf('seed-123', keys)).toBe('random-child-id')
    })

    // Defence in depth, and parity with the two copies that restate this
    // predicate: `entropyKey` alone would also match a derived key, and
    // PBKDF2ing one of those would mint a passkey main key no mnemonic
    // reproduces.
    test('ignores an entropyKey flag on a record that is not a secret-key', () => {
        const mislabelled = [
            {
                id: 'not-a-secret',
                type: 'hd-derived-ed25519',
                metadata: entropyChildMetadata('seed-123'),
            },
        ] as unknown as Key[]

        expect(entropyChildIdOf('seed-123', mislabelled)).toBeUndefined()
    })

    test('ignores non-entropy children of the same seed', () => {
        const onlyDerived = keys.filter(k => k.id !== 'random-child-id')
        expect(entropyChildIdOf('seed-123', onlyDerived)).toBeUndefined()
    })

    test('returns undefined when the seed has no entropy child', () => {
        expect(entropyChildIdOf('other-seed', keys)).toBeUndefined()
    })
})

describe('hexToBytes', () => {
    test('decodes a lowercase hex string to its bytes', () => {
        expect(Array.from(hexToBytes('010203ff'))).toEqual([1, 2, 3, 255])
    })

    test('throws on an odd-length string instead of dropping the last nibble', () => {
        expect(() => hexToBytes('abc')).toThrow()
    })

    test('throws on non-hex characters instead of decoding them to 0', () => {
        expect(() => hexToBytes('zz')).toThrow()
    })
})

describe('quantum scheme constants', () => {
    test('SeedScheme.Quantum is the literal "quantum"', () => {
        expect(SeedScheme.Quantum).toBe('quantum')
    })

    test('QUANTUM_SEED_LENGTH matches the 32-byte algo25 entropy size', () => {
        expect(QUANTUM_SEED_LENGTH).toBe(32)
    })
})
