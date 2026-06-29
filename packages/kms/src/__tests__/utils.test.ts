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

import { describe, test, expect, vi } from 'vitest'
import type { Key } from '@algorandfoundation/keystore'

vi.mock('@algorandfoundation/algokit-utils', () => ({
    encodeAddress: (bytes: Uint8Array) =>
        `ADDR_${Buffer.from(bytes).toString('hex')}`,
}))

import {
    aclOf,
    algo25AddressOf,
    buildSeedMetadata,
    createdAtOf,
    expiresAtOf,
    hexToBytes,
    isSeedKey,
    seedSchemeOf,
} from '../utils'
import { AccessControlPermission } from '../models'
import { SeedScheme } from '../constants'

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

    test('stashes entropy as a lowercase hex string when provided', () => {
        const entropy = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
        const meta = buildSeedMetadata({ scheme: SeedScheme.Bip39, entropy })
        expect(meta.entropy).toBe('deadbeef')
    })

    test('omits the entropy field entirely when not provided', () => {
        const meta = buildSeedMetadata({ scheme: SeedScheme.Algo25 })
        expect('entropy' in meta).toBe(false)
    })
})

describe('hexToBytes', () => {
    test('round-trips with the hex emitted by buildSeedMetadata', () => {
        const entropy = new Uint8Array([1, 2, 3, 255])
        const meta = buildSeedMetadata({ scheme: SeedScheme.Bip39, entropy })
        expect(Array.from(hexToBytes(meta.entropy!))).toEqual(
            Array.from(entropy),
        )
    })

    test('throws on an odd-length string instead of dropping the last nibble', () => {
        expect(() => hexToBytes('abc')).toThrow()
    })

    test('throws on non-hex characters instead of decoding them to 0', () => {
        expect(() => hexToBytes('zz')).toThrow()
    })
})
