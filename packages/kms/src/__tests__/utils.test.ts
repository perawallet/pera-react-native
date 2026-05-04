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

import { keystoreKeyToKeyPair, peraMetadataFor, makeKeyPair } from '../utils'
import { AccessControlPermission, KeyType } from '../models'

describe('keystoreKeyToKeyPair', () => {
    test('maps an HD root key to a wallet-domain HD root KeyPair', () => {
        const key: Key = {
            id: 'wallet-1',
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: true,
        }

        const kp = keystoreKeyToKeyPair(key)

        expect(kp).not.toBeNull()
        expect(kp?.id).toBe('wallet-1')
        expect(kp?.keystoreKeyId).toBe('wallet-1')
        expect(kp?.type).toBe(KeyType.HDWalletRootKey)
        expect(kp?.publicKey).toBe('') // HD root has no usable address
    })

    test('maps an Algo25 root key to an Algo25 KeyPair with encoded address', () => {
        const publicKey = new Uint8Array([1, 2, 3])
        const key: Key = {
            id: 'algo25-1',
            type: 'algo25',
            algorithm: 'EdDSA',
            extractable: true,
            publicKey,
        }

        const kp = keystoreKeyToKeyPair(key)

        expect(kp).not.toBeNull()
        expect(kp?.id).toBe('algo25-1')
        expect(kp?.type).toBe(KeyType.Algo25Key)
        expect(kp?.publicKey).toBe('ADDR_010203')
    })

    test('returns null for HD-derived child keys (type hd-derived-ed25519, used only for HD children)', () => {
        const key: Key = {
            id: 'derived-child-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: {
                parentKeyId: 'wallet-1',
                account: 0,
                path: "m/44'/283'/0'/0/0",
            },
        }

        expect(keystoreKeyToKeyPair(key)).toBeNull()
    })

    test('returns null for entropy/seed entries (type hd-seed)', () => {
        const key: Key = {
            id: 'wallet-1-entropy',
            type: 'hd-seed',
            algorithm: 'raw',
            extractable: true,
        }

        expect(keystoreKeyToKeyPair(key)).toBeNull()
    })

    test('round-trips acl, createdAt, expiresAt through pera metadata', () => {
        const createdAt = new Date('2025-06-01T12:00:00Z')
        const expiresAt = new Date('2025-12-01T12:00:00Z')
        const acl = [
            {
                domains: ['backup-flow'],
                permissions: [AccessControlPermission.ReadPrivate],
            },
        ]

        const key: Key = {
            id: 'wallet-1',
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: true,
            metadata: peraMetadataFor({ acl, createdAt, expiresAt }),
        }

        const kp = keystoreKeyToKeyPair(key)

        expect(kp?.acl).toEqual(acl)
        expect(kp?.createdAt?.toISOString()).toBe(createdAt.toISOString())
        expect(kp?.expiresAt?.toISOString()).toBe(expiresAt.toISOString())
    })

    test('defaults createdAt to "now" and acl to [] when pera metadata is absent', () => {
        const before = Date.now()
        const key: Key = {
            id: 'wallet-1',
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: true,
        }

        const kp = keystoreKeyToKeyPair(key)

        expect(kp?.acl).toEqual([])
        expect(kp?.createdAt?.getTime()).toBeGreaterThanOrEqual(before)
        expect(kp?.expiresAt).toBeUndefined()
    })

    test('returns null for unknown keystore types', () => {
        const key: Key = {
            id: 'rsa-1',
            type: 'rsa',
            algorithm: 'RS256',
            extractable: true,
        }

        expect(keystoreKeyToKeyPair(key)).toBeNull()
    })
})

describe('peraMetadataFor', () => {
    test('serializes Date fields to ISO strings under the pera namespace', () => {
        const createdAt = new Date('2025-01-01T00:00:00Z')
        const expiresAt = new Date('2026-01-01T00:00:00Z')

        const meta = peraMetadataFor({ createdAt, expiresAt })

        expect(meta.pera.createdAt).toBe('2025-01-01T00:00:00.000Z')
        expect(meta.pera.expiresAt).toBe('2026-01-01T00:00:00.000Z')
    })

    test('defaults createdAt to now() when not provided', () => {
        const before = Date.now()
        const meta = peraMetadataFor({})
        const created = new Date(meta.pera.createdAt!).getTime()
        expect(created).toBeGreaterThanOrEqual(before)
    })
})

describe('makeKeyPair', () => {
    test('applies sensible defaults', () => {
        const kp = makeKeyPair({})

        expect(kp.id).toBe('')
        expect(kp.publicKey).toBe('')
        expect(kp.acl).toEqual([])
        expect(kp.createdAt).toBeInstanceOf(Date)
    })
})
