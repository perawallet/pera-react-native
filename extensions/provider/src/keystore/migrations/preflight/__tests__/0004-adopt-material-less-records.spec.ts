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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import {
    MasterKeyNotFoundError,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import { decode, sealCanary13Record } from '../../__fixtures__/keystoreFormats'
import { createDeclinedRegister } from '../../declined'
import { LAYOUT_VERSION_KEY } from '../0003-remove-layout-version-stamp'
import { migration } from '../0004-adopt-material-less-records'
import { PREFLIGHT_MODULE_ID, preflightMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

let logWarn: ReturnType<typeof vi.fn>

const utils = (): MigrationUtils => ({
    revision: {
        module: PREFLIGHT_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
    log: { info: vi.fn(), warn: logWarn, error: vi.fn() },
})

/** Stands in for the migrations ledger's MMKV instance. */
let noteStore: Record<string, string>

const noteStoreApi = () => ({
    getString: (key: string) => noteStore[key],
    set: (key: string, value: string) => {
        noteStore[key] = value
    },
})

let masterKeyForRead: ReturnType<typeof vi.fn>

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: masterKeyForRead as () => Promise<Uint8Array>,
    declined: createDeclinedRegister(noteStoreApi()),
})

const seeded = async (
    ...records: Record<string, unknown>[]
): Promise<FakeKeychainStorage> => {
    const storage = fakeStorage({})
    for (const record of records) {
        storage.set(
            record.id as string,
            await sealCanary13Record(subtle, MASTER_KEY, record),
        )
    }
    return storage
}

describe('0004-adopt-material-less-records', () => {
    beforeEach(() => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY.slice())
        noteStore = {}
        logWarn = vi.fn()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // Ported from the deleted `migrateKeystoreLayout.spec.ts`: "migrates a
    // record with no private key without writing a material entry".
    it('adopts a watch-only record with no material into k/, writing no m/ entry', async () => {
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('watch-1')).toBeUndefined()
        expect(storage.getString(`m/watch-1`)).toBeUndefined()
        expect(
            decode(storage.getString(`${METADATA_PREFIX}watch-1`)!),
        ).toMatchObject({
            id: 'watch-1',
            publicKey: new Uint8Array(32).fill(3),
        })
    })

    // Ported from the deleted spec: "fills in bip44Path and derivationType for
    // an hd-derived child" — every HD-derived child `keystore-core` mints
    // (`deriveFromSeed`/`deriveDomainKey`) is exactly this shape: no material
    // of its own, ever. This revision only has to land it in `k/`; the
    // vocabulary rewrite (`path`→`bip44Path`, `storage: 'none'`) is
    // `repairs/0001-normalize-canary13-records`'s job once the record is
    // there, already covered by that revision's own spec — so this test pins
    // the untouched canary.13 field names, not the normalised ones.
    it('adopts an HD-derived child with no material of its own', async () => {
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

        expect(storage.getString('d-1')).toBeUndefined()
        const metadata = decode(storage.getString(`${METADATA_PREFIX}d-1`)!)
        expect(metadata.metadata).toMatchObject({
            path: "m/44'/283'/0'/0/0",
            derivation: 9,
            parentKeyId: 'r-1',
        })
    })

    it('leaves a record with top-level material alone', async () => {
        const storage = await seeded({
            id: 'key-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            privateKey: new Uint8Array(32).fill(1),
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('key-1')).toBeDefined()
        expect(storage.getString(`${METADATA_PREFIX}key-1`)).toBeUndefined()
    })

    // Writing this record's metadata verbatim into plaintext k/ without
    // lifting the nested secret first would leak it — the exact hazard 0002
    // exists to prevent. Out of scope here on purpose (see the revision's own
    // doc comment): left flat and reported, not silently dropped.
    it('leaves a record with only nested material flat, and records it as declined', async () => {
        const storage = await seeded({
            id: 'derived-2',
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

        expect(storage.getString('derived-2')).toBeDefined()
        expect(storage.getString(`${METADATA_PREFIX}derived-2`)).toBeUndefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual(['derived-2'])
    })

    // Mirrors 0002's identical guard: the driver reads a record back at
    // `k/<storageKey>`, so an id that disagrees with the storage key cannot
    // be split coherently under either.
    it('leaves a record whose id disagrees with its storage key flat', async () => {
        const storage = fakeStorage({})
        storage.set(
            'storage-key-1',
            await sealCanary13Record(subtle, MASTER_KEY, {
                id: 'a-different-id',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                publicKey: new Uint8Array(32).fill(7),
            }),
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('storage-key-1')).toBeDefined()
        expect(
            storage.getString(`${METADATA_PREFIX}storage-key-1`),
        ).toBeUndefined()
        expect(
            storage.getString(`${METADATA_PREFIX}a-different-id`),
        ).toBeUndefined()
    })

    // A write that fails must not fail the whole module — that would reject
    // `keystore.ready` and stop the app booting over one record. Left flat
    // for a later run, same as every other non-adopted outcome.
    it('leaves a record flat and reports it when the metadata write throws', async () => {
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })
        const set = storage.set
        storage.set = () => {
            throw new Error('MMKV write failed')
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        storage.set = set
        expect(storage.getString('watch-1')).toBeDefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual(['watch-1'])
    })

    it('adopts the material-less record while leaving a real key beside it alone', async () => {
        const storage = await seeded(
            {
                id: 'watch-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                publicKey: new Uint8Array(32).fill(3),
            },
            {
                id: 'key-1',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                privateKey: new Uint8Array(32).fill(1),
            },
        )

        await migration.up(context(storage), utils())

        expect(storage.getString(`${METADATA_PREFIX}watch-1`)).toBeDefined()
        expect(storage.getString('key-1')).toBeDefined()
    })

    // A record this pass cannot open belongs to another writer or is not a
    // record at all; upstream's own adoption reports it, ours must not fail
    // the module.
    it('skips a record it cannot decrypt without throwing', async () => {
        const storage = fakeStorage({
            'cred-1': JSON.stringify({ iv: 'AAAA', content: 'BBBB' }),
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.getString('cred-1')).toBeDefined()
    })

    // A fresh install has no Keychain master key; upstream's own reading is
    // that this means "nothing to migrate", not a failure.
    it('is a no-op when the master key is missing, not a throw', async () => {
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })
        const before = storage.entries()
        masterKeyForRead = vi.fn(async () => {
            throw new MasterKeyNotFoundError()
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual(before)
    })

    it('rethrows a master-key read failure that is not MasterKeyNotFoundError', async () => {
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })
        masterKeyForRead = vi.fn(async () => {
            throw new Error('unlock cancelled')
        })

        await expect(migration.up(context(storage), utils())).rejects.toThrow(
            'unlock cancelled',
        )
    })

    // Reading the master key is the only step that can raise a biometric
    // prompt; a store with nothing to adopt must never pay for one.
    it('does not touch the master key when there is no flat candidate', async () => {
        const storage = fakeStorage({
            'k/key-1': JSON.stringify({ id: 'key-1', type: 'ed25519' }),
        })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('does not treat the migrations ledger blob as a flat record', async () => {
        const storage = fakeStorage({
            '@algorandfoundation/provider-migrations': '{"modules":{}}',
        })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    // `0003` runs first and deletes this key outright, but if it were ever
    // still present, decrypting it as a record would be nonsensical.
    it('does not treat the layout-version stamp as a flat record', async () => {
        const storage = fakeStorage({ [LAYOUT_VERSION_KEY]: '1' })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('reports every record it could not adopt', async () => {
        const storage = await seeded({
            id: 'derived-2',
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

        await migration.up(context(storage), utils())

        expect(logWarn).toHaveBeenCalledWith(
            expect.stringContaining('1 flat record(s) unadopted'),
            { entries: ['derived-2'] },
            PREFLIGHT_MODULE_ID,
        )
    })

    it('reports nothing when every candidate was adopted or already had material', async () => {
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })

        await migration.up(context(storage), utils())

        expect(logWarn).not.toHaveBeenCalled()
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
        const storage = await seeded({
            id: 'watch-1',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            publicKey: new Uint8Array(32).fill(3),
        })

        await assertIdempotent({
            migration,
            context: () => context(storage),
            snapshot: ({ storage: store }) =>
                (store as FakeKeychainStorage).entries(),
        })
    })

    it('has a valid manifest', () => {
        expect(() =>
            validateMigrations(preflightMigrations, PREFLIGHT_MODULE_ID),
        ).not.toThrow()
    })
})
