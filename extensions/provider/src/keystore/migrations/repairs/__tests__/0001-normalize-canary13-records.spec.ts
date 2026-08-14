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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { base64 } from '@scure/base'
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// See 0002-lift-nested-material.spec.ts for why the package root is mocked and
// why the prefixes, `serializeKey` and `MasterKeyNotFoundError` still come from
// its real dist while `sealData`/`openData`/`decode` cannot.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../../__fixtures__/keystoreFormats')

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        MasterKeyNotFoundError: errors.MasterKeyNotFoundError,
        sealData: formats.sealData,
        openData: formats.openData,
        decode: formats.decode,
    }
})

import { serializeKey } from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import { decode, openData, sealData } from '../../__fixtures__/keystoreFormats'
import { SECRET_FIELDS } from '../../canary13'
import { migration } from '../0001-normalize-canary13-records'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

const utils = (): MigrationUtils => ({
    revision: {
        module: REPAIRS_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
})

let masterKeyForRead: ReturnType<typeof vi.fn>

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: masterKeyForRead as () => Promise<Uint8Array>,
})

/** Seeds a split record: plaintext `k/<id>` plus, optionally, sealed `m/<id>`. */
const seeded = async (
    record: Record<string, unknown> & { id: string },
    material?: Uint8Array,
): Promise<FakeKeychainStorage> => {
    const storage = fakeStorage({
        [`k/${record.id}`]: serializeKey(
            record as unknown as Parameters<typeof serializeKey>[0],
        ),
    })
    if (material) {
        storage.set(
            `m/${record.id}`,
            await sealData(subtle, MASTER_KEY, base64.encode(material)),
        )
    }
    return storage
}

const metadataOf = (storage: FakeKeychainStorage, id: string) =>
    decode(storage.getString(`k/${id}`)!)

const materialOf = async (storage: FakeKeychainStorage, id: string) =>
    base64.decode(
        await openData(subtle, MASTER_KEY, storage.getString(`m/${id}`)!),
    )

/** Every path at which a `SECRET_FIELDS` name appears, at any depth. */
const secretPathsIn = (value: unknown, path = ''): string[] => {
    if (value instanceof Uint8Array || value === null) return []
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            secretPathsIn(item, `${path}[${index}]`),
        )
    }
    if (typeof value !== 'object') return []

    return Object.entries(value as Record<string, unknown>).flatMap(
        ([field, nested]) => {
            const here = path ? `${path}.${field}` : field
            return SECRET_FIELDS.has(field)
                ? [here]
                : secretPathsIn(nested, here)
        },
    )
}

describe('0001-normalize-canary13-records', () => {
    beforeEach(() => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY)
    })

    // `sign` dispatches on `type`: `falcon1024` misses the `falcon-1024` case
    // and falls to a default branch whose `signAlgorithm` is the JWK `alg`
    // value `EdDSA`, not a WebCrypto algorithm name.
    it('relabels a canary.13 falcon child to the canary.19 key type', async () => {
        const storage = await seeded(
            {
                id: 'q-1',
                type: 'falcon1024',
                algorithm: 'raw',
                extractable: false,
                metadata: { parentKeyId: 'seed-q' },
            },
            new Uint8Array(64).fill(5),
        )

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'q-1')).toMatchObject({
            type: 'falcon-1024',
            algorithm: 'Falcon-1024',
        })
    })

    // The bytes are the 96-byte XHD extended root, and `deriveFromSeed` rejects
    // any parent not typed `hd-root-key`. `scheme` must survive: kms reads it to
    // decide the wallet kind.
    it('promotes a bip39 seed record to an hd-root-key', async () => {
        const storage = await seeded(
            {
                id: 'r-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: { scheme: 'bip39' },
            },
            new Uint8Array(96).fill(3),
        )

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'r-1')).toMatchObject({
            type: 'hd-root-key',
            metadata: { scheme: 'bip39' },
        })
    })

    // The promotion keys off `scheme`, not `type` alone; algo25 and quantum
    // seeds are seeds and must stay that way.
    it.each(['algo25', 'quantum'])(
        'leaves a %s seed record typed seed',
        async scheme => {
            const storage = await seeded(
                {
                    id: 's-1',
                    type: 'seed',
                    algorithm: 'raw',
                    extractable: true,
                    metadata: { scheme },
                },
                new Uint8Array(32).fill(6),
            )

            await migration.up(context(storage), utils())

            expect(metadataOf(storage, 's-1').type).toBe('seed')
        },
    )

    // canary.13 stored libsodium's raw 64-byte secret key; canary.19 re-imports
    // through the host Subtle, which takes PKCS#8.
    it('rewrites a raw ed25519 secret key as pkcs8 with a signAlgorithm', async () => {
        const seed = new Uint8Array(32).fill(1)
        const storage = await seeded(
            {
                id: 'a-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'raw',
                extractable: false,
                metadata: { parentKeyId: 'seed-a' },
            },
            new Uint8Array([...seed, ...new Uint8Array(32).fill(2)]),
        )

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'a-1')).toMatchObject({
            format: 'pkcs8',
            metadata: { signAlgorithm: { name: 'Ed25519' }, storage: 'bytes' },
        })
        const material = await materialOf(storage, 'a-1')
        expect(material).toHaveLength(48)
        expect(material.slice(16)).toEqual(seed)
    })

    // Half-applied state: `m/` was re-sealed as PKCS#8 and the process died
    // before `k/` was rewritten. The 64-byte length test no longer matches, so
    // without a second route the record is stuck unsigned forever.
    it('labels an already-converted pkcs8 record without re-converting it', async () => {
        const seed = new Uint8Array(32).fill(1)
        const pkcs8 = new Uint8Array([
            0x30,
            0x2e,
            0x02,
            0x01,
            0x00,
            0x30,
            0x05,
            0x06,
            0x03,
            0x2b,
            0x65,
            0x70,
            0x04,
            0x22,
            0x04,
            0x20,
            ...seed,
        ])
        const storage = await seeded(
            {
                id: 'a-2',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'raw',
                extractable: false,
                metadata: {},
            },
            pkcs8,
        )

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'a-2')).toMatchObject({
            format: 'pkcs8',
            metadata: { signAlgorithm: { name: 'Ed25519' } },
        })
        expect(await materialOf(storage, 'a-2')).toEqual(pkcs8)
    })

    // `sign` reads the parsed `bip44Path` and `derivationType`, and silently
    // derives from `undefined` segments without them.
    it('fills in bip44Path and derivationType for an hd-derived child', async () => {
        const storage = await seeded({
            id: 'd-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(7),
            metadata: {
                path: "m/44'/283'/0'/0/0",
                derivation: 9,
                parentKeyId: 'r-1',
            },
        })

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'd-1').metadata).toMatchObject({
            bip44Path: [0x80_00_00_2c, 0x80_00_01_1b, 0x80_00_00_00, 0, 0],
            derivationType: 9,
        })
    })

    it('derives metadata.storage as bytes when the record has sealed material', async () => {
        const storage = await seeded(
            {
                id: 'b-1',
                type: 'falcon-1024',
                algorithm: 'Falcon-1024',
                extractable: false,
                metadata: { parentKeyId: 'seed-q' },
            },
            new Uint8Array(64).fill(5),
        )

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'b-1').metadata).toMatchObject({
            storage: 'bytes',
        })
    })

    it('derives metadata.storage as none for a watch-only record', async () => {
        const storage = await seeded({
            id: 'w-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
            metadata: {},
        })

        await migration.up(context(storage), utils())

        expect(metadataOf(storage, 'w-1').metadata).toMatchObject({
            storage: 'none',
        })
    })

    // The backstop for a preflight adoption that failed and left the record for
    // upstream, which strips only top-level material.
    it('lifts nested material out of the plaintext bucket and seals it', async () => {
        const rootSecret = new Uint8Array(64).fill(11)
        const storage = await seeded({
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(4),
            metadata: {
                parentKeyId: 'root-1',
                rootKey: {
                    id: 'root-1',
                    type: 'hd-root-key',
                    privateKey: rootSecret,
                },
            },
        })

        await migration.up(context(storage), utils())

        const raw = storage.getString('k/derived-1')!
        expect(secretPathsIn(decode(raw))).toEqual([])
        expect(raw).not.toContain(base64.encode(rootSecret))
        expect(await materialOf(storage, 'root-1')).toEqual(rootSecret)
    })

    it('keeps the non-secret structure of the nested carrier', async () => {
        const storage = await seeded({
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: {
                rootKey: {
                    id: 'root-1',
                    type: 'hd-root-key',
                    privateKey: new Uint8Array(64).fill(11),
                },
            },
        })

        await migration.up(context(storage), utils())

        const metadata = metadataOf(storage, 'derived-1') as {
            metadata?: { rootKey?: Record<string, unknown> }
        }
        expect(metadata.metadata?.rootKey).toEqual({
            id: 'root-1',
            type: 'hd-root-key',
        })
    })

    it('does not let an embedded copy overwrite an id’s own sealed material', async () => {
        const storage = await seeded({
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: {
                rootKey: {
                    id: 'root-1',
                    privateKey: new Uint8Array(64).fill(12),
                },
            },
        })
        storage.set(
            'm/root-1',
            await sealData(
                subtle,
                MASTER_KEY,
                base64.encode(new Uint8Array(96).fill(5)),
            ),
        )

        await migration.up(context(storage), utils())

        expect(await materialOf(storage, 'root-1')).toEqual(
            new Uint8Array(96).fill(5),
        )
    })

    // What makes this revision safe on a device that already ran Pera's
    // in-house layout migration: those records are already in this vocabulary.
    it('is a no-op on records already in canary.19 vocabulary', async () => {
        const storage = await seeded(
            {
                id: 'm-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'pkcs8',
                extractable: false,
                publicKey: new Uint8Array(32).fill(2),
                metadata: {
                    storage: 'bytes',
                    signAlgorithm: { name: 'Ed25519' },
                },
                version: 1,
            },
            new Uint8Array(48).fill(4),
        )
        const before = storage.entries()
        const written: string[] = []
        const set = storage.set
        storage.set = (key, value) => {
            written.push(key)
            set(key, value)
        }

        await migration.up(context(storage), utils())

        // Not merely "the bytes are the same": re-serialising an unchanged
        // record would compare equal while still writing every `k/` entry on
        // every device that has already been normalised.
        expect(written).toEqual([])
        expect(storage.entries()).toEqual(before)
        // And the record must be *judged* from its plaintext metadata. Opening
        // this one's material to measure it would leave the entries above
        // identical while costing a biometric prompt at launch on every device
        // that has nothing left to migrate.
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    // Copy, verify, delete: the plaintext copy of a secret is only dropped once
    // its sealed replacement is proven readable.
    it('leaves the record untouched when the sealed material does not read back', async () => {
        const storage = await seeded({
            id: 'derived-1',
            type: 'hd-derived-ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            metadata: {
                rootKey: {
                    id: 'root-1',
                    privateKey: new Uint8Array(64).fill(11),
                },
            },
        })
        const before = storage.entries()
        const set = storage.set
        storage.set = (key, value) => {
            if (!key.startsWith('m/')) set(key, value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(storage.entries()).toEqual(before)
    })

    // Reading the master key is the only step that can raise a biometric
    // prompt; a rename touches no material and must not pay for one.
    it('does not read the master key for a metadata-only rewrite', async () => {
        const storage = await seeded({
            id: 'q-1',
            type: 'falcon1024',
            algorithm: 'raw',
            extractable: false,
            metadata: { parentKeyId: 'seed-q' },
        })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
        expect(metadataOf(storage, 'q-1').type).toBe('falcon-1024')
    })

    // A fresh install has no master key. The metadata-only work still lands;
    // the record needing material is left exactly as it was, for a later build
    // to retry, rather than failing the module and blocking boot.
    it('leaves a material-dependent record untouched when the master key is missing', async () => {
        const storage = await seeded(
            {
                id: 'a-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'raw',
                extractable: false,
                metadata: {},
            },
            new Uint8Array(64).fill(1),
        )
        const before = storage.entries()
        masterKeyForRead = vi.fn(async () => {
            throw new Error('Master key not found')
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual(before)
    })

    it('normalises the other records when one of them fails', async () => {
        const storage = await seeded({
            id: 'q-1',
            type: 'falcon1024',
            algorithm: 'raw',
            extractable: false,
            metadata: { parentKeyId: 'seed-q' },
        })
        storage.set('k/broken', 'not json')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(metadataOf(storage, 'q-1').type).toBe('falcon-1024')
        expect(storage.getString('k/broken')).toBe('not json')
    })

    it('ignores flat and sealed entries, rewriting only the k/ bucket', async () => {
        const storage = await seeded({
            id: 'q-1',
            type: 'falcon1024',
            algorithm: 'raw',
            extractable: false,
            metadata: {},
        })
        storage.set('flat-1', '{"iv":"aXY=","tag":"dGc=","content":"Y3Q="}')

        await migration.up(context(storage), utils())

        expect(storage.getString('flat-1')).toBe(
            '{"iv":"aXY=","tag":"dGc=","content":"Y3Q="}',
        )
    })

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('is idempotent', async () => {
        const seed = new Uint8Array(32).fill(1)
        const storage = await seeded(
            {
                id: 'a-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                format: 'raw',
                extractable: false,
                metadata: {
                    rootKey: {
                        id: 'root-1',
                        privateKey: new Uint8Array(64).fill(11),
                    },
                },
            },
            new Uint8Array([...seed, ...new Uint8Array(32).fill(2)]),
        )

        await assertIdempotent({
            migration,
            context: () => context(storage),
            snapshot: ({ storage: store }) =>
                (store as FakeKeychainStorage).entries(),
        })
    })

    it('has a valid manifest', () => {
        expect(() =>
            validateMigrations(repairsMigrations, REPAIRS_MODULE_ID),
        ).not.toThrow()
    })
})
