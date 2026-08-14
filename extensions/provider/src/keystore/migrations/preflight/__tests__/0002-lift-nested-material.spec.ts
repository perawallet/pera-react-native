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
import { base64 } from '@scure/base'
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// The package root executes native Keychain/Nitro bindings at import time,
// which vitest cannot run, and vitest cannot intercept a mock inside an
// externalised dependency's own graph — so every spec here mocks the whole
// module (see 0001-retire-hd-root-shadow.spec.ts). What can come from the real
// dist does: `driver.js` and `errors.js` depend only on `@scure/base` and
// `keystore-core`, so the prefixes, `serializeKey` and the error class this
// revision branches on are the genuine articles and an upstream change to any
// of them still breaks this test. `crypto.js` and `state.js` cannot follow —
// they pull in react-native-keychain/quick-crypto/mmkv — so `sealData`,
// `openData` and `decode` come from the shared format stand-ins. Paths are
// relative because the package's `exports` map publishes only `.`.
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
import {
    decode,
    decodedRecords,
    openData,
    resetDecoded,
    sealCanary13Record,
} from '../../__fixtures__/keystoreFormats'
import { SECRET_FIELDS } from '../../canary13'
import { createDeclinedRegister } from '../../declined'
import { migration } from '../0002-lift-nested-material'
import { PREFLIGHT_MODULE_ID, preflightMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

const ROOT_SECRET = new Uint8Array(64).fill(11)
const OWN_SECRET = new Uint8Array(32).fill(1)

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
/** The buffer the last read handed out, so the wipe can be asserted on. */
let lastMasterKey: Uint8Array | undefined

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: masterKeyForRead as () => Promise<Uint8Array>,
    declined: createDeclinedRegister(noteStoreApi()),
})

/**
 * The record this revision exists for: material at the top level **and** under
 * `metadata.rootKey`. Upstream's `adoptLegacyRecords` strips only the former
 * and writes the rest into the plaintext `k/` bucket verbatim.
 */
const nestedAndTopLevel = (id = 'derived-1') => ({
    id,
    type: 'hd-derived-ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    privateKey: OWN_SECRET,
    publicKey: new Uint8Array(32).fill(4),
    metadata: {
        parentKeyId: 'root-1',
        rootKey: {
            id: 'root-1',
            type: 'hd-root-key',
            privateKey: ROOT_SECRET,
        },
    },
})

const topLevelOnly = (id = 'key-1') => ({
    id,
    type: 'ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    privateKey: OWN_SECRET,
    publicKey: new Uint8Array(32).fill(2),
    metadata: { fromMnemonic: true },
})

const nestedOnly = (id = 'derived-2') => ({
    id,
    type: 'hd-derived-ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    publicKey: new Uint8Array(32).fill(4),
    metadata: {
        rootKey: { id: 'root-1', type: 'hd-root-key', privateKey: ROOT_SECRET },
    },
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

/**
 * Every path at which a `SECRET_FIELDS` name appears, at any depth.
 *
 * The point of the revision is what upstream misses *below* the top level, so
 * asserting on `metadata.privateKey === undefined` alone would pass while the
 * private key sat two levels down.
 */
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

describe('0002-lift-nested-material', () => {
    beforeEach(() => {
        // A fresh buffer per read, as `readMasterKey` gives: the revision
        // zeroes what it was handed, and a shared array would be zeroed out
        // from under the assertions that follow.
        masterKeyForRead = vi.fn(async () => {
            lastMasterKey = MASTER_KEY.slice()
            return lastMasterKey
        })
        lastMasterKey = undefined
        noteStore = {}
        logWarn = vi.fn()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('adopts a record carrying material both at the top level and nested', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        expect(storage.getString('k/derived-1')).toBeDefined()
        expect(storage.getString('m/derived-1')).toBeDefined()
        expect(storage.getString('derived-1')).toBeUndefined()
    })

    // The whole point of the revision: nothing secret may reach `k/`, at any
    // depth. A top-level-only assertion would pass while the HD root's private
    // key sat unencrypted under `metadata.rootKey`.
    it('leaves no secret field anywhere in the plaintext metadata payload', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        const raw = storage.getString('k/derived-1')!
        expect(secretPathsIn(decode(raw))).toEqual([])
        expect(raw).not.toContain(base64.encode(ROOT_SECRET))
        expect(raw).not.toContain(base64.encode(OWN_SECRET))
    })

    it('keeps the non-secret structure of the nested carrier', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        const metadata = decode(storage.getString('k/derived-1')!) as {
            publicKey?: Uint8Array
            metadata?: { rootKey?: Record<string, unknown> }
        }
        expect(metadata.metadata?.rootKey).toEqual({
            id: 'root-1',
            type: 'hd-root-key',
        })
        expect(metadata.publicKey).toEqual(new Uint8Array(32).fill(4))
    })

    // Lifting must protect the bytes, not discard them.
    it('seals lifted material under the id that owns it', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        const own = await openData(
            subtle,
            MASTER_KEY,
            storage.getString('m/derived-1')!,
        )
        const root = await openData(
            subtle,
            MASTER_KEY,
            storage.getString('m/root-1')!,
        )
        expect(base64.decode(own)).toEqual(OWN_SECRET)
        expect(base64.decode(root)).toEqual(ROOT_SECRET)
    })

    // Upstream adopts this one correctly — its only material is top level, so
    // the destructure strips all of it. Taking it here would duplicate a pass
    // that already works and widen this revision's blast radius for nothing.
    it('leaves a top-level-only record flat for upstream to adopt', async () => {
        const storage = await seeded(topLevelOnly())

        await migration.up(context(storage), utils())

        expect(storage.getString('key-1')).toBeDefined()
        expect(storage.getString('k/key-1')).toBeUndefined()
        expect(storage.getString('m/key-1')).toBeUndefined()
    })

    // Upstream reports this one as carrying no material and leaves it flat, so
    // nothing of it ever reaches the plaintext bucket. Not at risk.
    it('leaves a nested-only record flat', async () => {
        const storage = await seeded(nestedOnly())

        await migration.up(context(storage), utils())

        expect(storage.getString('derived-2')).toBeDefined()
        expect(storage.getString('k/derived-2')).toBeUndefined()
    })

    it('adopts the at-risk record while leaving its neighbours alone', async () => {
        const storage = await seeded(nestedAndTopLevel(), topLevelOnly())

        await migration.up(context(storage), utils())

        expect(storage.getString('derived-1')).toBeUndefined()
        expect(storage.getString('key-1')).toBeDefined()
    })

    // The record that owns an id is the authority on its material; an embedded
    // copy must never overwrite it.
    it('does not overwrite an id’s existing sealed material with an embedded copy', async () => {
        const storage = await seeded(nestedAndTopLevel())
        storage.set('m/root-1', 'the-authoritative-payload')

        await migration.up(context(storage), utils())

        expect(storage.getString('m/root-1')).toBe('the-authoritative-payload')
    })

    // A fresh install has no Keychain master key. Upstream's own adoption pass
    // treats that as "nothing to migrate"; throwing here would fail the module,
    // which rejects `keystore.ready` and stops the app booting.
    it('is a no-op when the master key is missing, not a throw', async () => {
        const storage = await seeded(nestedAndTopLevel())
        const before = storage.entries()
        masterKeyForRead = vi.fn(async () => {
            throw new MasterKeyNotFoundError()
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual(before)
    })

    // Anything other than a missing master key — a cancelled unlock, hardware
    // failure — is a real problem the runner must see, not silence.
    it('rethrows a master-key read failure that is not MasterKeyNotFoundError', async () => {
        const storage = await seeded(nestedAndTopLevel())
        masterKeyForRead = vi.fn(async () => {
            throw new Error('unlock cancelled')
        })

        await expect(migration.up(context(storage), utils())).rejects.toThrow(
            'unlock cancelled',
        )
    })

    // Reading the master key is the only step that can raise a biometric
    // prompt. A device already on the split layout must never see one at launch
    // because of this revision.
    it('does not touch the master key when there is no flat candidate', async () => {
        const storage = fakeStorage({
            'k/key-1': JSON.stringify({ id: 'key-1', type: 'ed25519' }),
            'm/key-1': '{"iv":"aXY=","content":"Y3Q="}',
        })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    // Applications are advised to keep the ledger in its own MMKV instance, but
    // one pointed at this keystore's would otherwise be decrypted as a record.
    // Upstream's `isFlatCandidate` excludes it by the same literal.
    it('does not treat the migrations ledger blob as a flat record', async () => {
        const storage = fakeStorage({
            '@algorandfoundation/provider-migrations': '{"modules":{}}',
        })

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).not.toHaveBeenCalled()
        expect(
            storage.getString('@algorandfoundation/provider-migrations'),
        ).toBe('{"modules":{}}')
    })

    // A record this pass cannot open belongs to another writer (the iOS
    // credential provider seals with unpadded base64 `openData` rejects) or is
    // not a record at all. Upstream reports it; ours must not fail the module.
    it('skips a record it cannot decrypt without throwing', async () => {
        const storage = fakeStorage({
            'cred-1': JSON.stringify({ iv: 'AAAA', content: 'BBBB' }),
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.getString('cred-1')).toBeDefined()
        expect(storage.getString('k/cred-1')).toBeUndefined()
    })

    // Copy, verify, delete. A write that does not land must cost nothing: the
    // flat record is still the only copy until both buckets read back.
    it('keeps the flat record when the new buckets do not read back', async () => {
        const storage = await seeded(nestedAndTopLevel())
        const set = storage.set
        storage.set = (key, value) => {
            if (!key.startsWith('m/')) set(key, value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(storage.getString('derived-1')).toBeDefined()
        expect(storage.getString('k/derived-1')).toBeUndefined()
    })

    // The dangerous half of a failed adoption. A lifted `m/` write that LANDS
    // but cannot be opened looks occupied to the next run, which treats it as
    // authoritative, never rewrites it, and strips the secret from `k/` — the
    // HD root private key then exists nowhere. Suppressing the write entirely
    // (the neighbouring test) never reaches this.
    it('rolls back a lifted material write that lands unreadable', async () => {
        const storage = await seeded(nestedAndTopLevel())
        const set = storage.set
        storage.set = (key, value) => {
            set(key, key === 'm/root-1' ? 'truncated-ciphertext' : value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(storage.getString('derived-1')).toBeDefined()
        expect(storage.getString('k/derived-1')).toBeUndefined()
        expect(storage.getString('m/derived-1')).toBeUndefined()
        // The poison entry must not survive to be trusted next launch.
        expect(storage.getString('m/root-1')).toBeUndefined()
    })

    // A pre-existing bucket is not ours to destroy on the way out.
    it('restores a pre-existing material entry it overwrote when the record fails', async () => {
        const storage = await seeded(nestedAndTopLevel())
        storage.set('m/derived-1', 'someone-elses-payload')
        const set = storage.set
        storage.set = (key, value) => {
            if (!key.startsWith('k/')) set(key, value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(storage.getString('m/derived-1')).toBe('someone-elses-payload')
        expect(storage.getString('derived-1')).toBeDefined()
    })

    // One id addresses one `m/` bucket. `metadata.backup.privateKey` has no
    // `id` of its own, so it inherits the record's and collides with the
    // record's own material — sealing one would silently destroy the other.
    // Left flat, the record still holds both.
    it('declines a record whose nested secret has nowhere to be sealed', async () => {
        const orphan = new Uint8Array(64).fill(13)
        const storage = await seeded({
            id: 'key-c',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            privateKey: OWN_SECRET,
            metadata: { backup: { label: 'paper', privateKey: orphan } },
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('key-c')).toBeDefined()
        expect(storage.getString('k/key-c')).toBeUndefined()
        expect(storage.getString('m/key-c')).toBeUndefined()
    })

    // canary.13's HD/XHD roots carry their bytes under `seed`, not
    // `privateKey`. Reading only `privateKey` would leave the root class this
    // revision exists for entirely unhandled.
    it('adopts a record whose own material is a top-level seed', async () => {
        const rootSeed = new Uint8Array(96).fill(3)
        const storage = await seeded({
            id: 'root-2',
            type: 'seed',
            algorithm: 'raw',
            extractable: true,
            seed: rootSeed,
            metadata: {
                scheme: 'bip39',
                rootKey: {
                    id: 'root-1',
                    type: 'hd-root-key',
                    privateKey: ROOT_SECRET,
                },
            },
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('root-2')).toBeUndefined()
        expect(secretPathsIn(decode(storage.getString('k/root-2')!))).toEqual(
            [],
        )
        expect(
            base64.decode(
                await openData(
                    subtle,
                    MASTER_KEY,
                    storage.getString('m/root-2')!,
                ),
            ),
        ).toEqual(rootSeed)
    })

    // `SECRET_FIELDS` is the whole vocabulary of what counts as material.
    // Nested `seed` and `key` carriers are as dangerous as `privateKey` and
    // were previously covered by nothing.
    it.each(['privateKey', 'seed', 'key'])(
        'lifts a nested %s out of the plaintext bucket',
        async field => {
            const storage = await seeded({
                id: 'derived-3',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                privateKey: OWN_SECRET,
                metadata: {
                    rootKey: {
                        id: 'root-1',
                        type: 'hd-root-key',
                        [field]: ROOT_SECRET,
                    },
                },
            })

            await migration.up(context(storage), utils())

            const raw = storage.getString('k/derived-3')!
            expect(secretPathsIn(decode(raw))).toEqual([])
            expect(raw).not.toContain(base64.encode(ROOT_SECRET))
            expect(
                base64.decode(
                    await openData(
                        subtle,
                        MASTER_KEY,
                        storage.getString('m/root-1')!,
                    ),
                ),
            ).toEqual(ROOT_SECRET)
        },
    )

    // The credential provider shares this MMKV instance from another process
    // and is still on the bare-id layout. Neither real shape has nested
    // material, so neither is at risk and neither is touched — behaviour the
    // removed `migrateKeystoreLayout` exemption used to enforce explicitly.
    it('leaves a provider credential with a plain key flat', async () => {
        const storage = await seeded({
            id: 'cred-plain',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            privateKey: new Uint8Array(32).fill(3),
            publicKey: new Uint8Array(91).fill(4),
            metadata: {
                origin: 'example.com',
                userHandle: 'dXNlcg',
                userId: 'user-1',
                count: 0,
            },
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-plain')).toBeDefined()
        expect(storage.getString('k/cred-plain')).toBeUndefined()
    })

    // `privateKeyEnc` is an OBJECT — wrapped by an Android Keystore cipher this
    // package cannot open. It is not a `Uint8Array`, so the record reads as
    // carrying no material and is left alone rather than adopted without it.
    it('leaves a biometric provider credential flat', async () => {
        const storage = await seeded({
            id: 'cred-biometric',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            publicKey: new Uint8Array(91).fill(4),
            privateKeyEnc: { iv: 'aXY=', data: 'ZGF0YQ==' },
            metadata: { origin: 'example.com', userHandle: 'dXNlcg' },
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-biometric')).toBeDefined()
        expect(storage.getString('k/cred-biometric')).toBeUndefined()
    })

    // The driver reads a record back at `k/<record.id>`; a record whose id
    // disagrees with its storage key cannot be split coherently under either.
    it('leaves a record whose id disagrees with its storage key flat', async () => {
        const storage = fakeStorage({})
        storage.set(
            'storage-key-1',
            await sealCanary13Record(subtle, MASTER_KEY, {
                ...nestedAndTopLevel('a-different-id'),
            }),
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('storage-key-1')).toBeDefined()
        expect(storage.getString('k/storage-key-1')).toBeUndefined()
        expect(storage.getString('k/a-different-id')).toBeUndefined()
    })

    // A record left unmigrated now leaves state a later run has to interpret,
    // so it must not be silent. `utils.log` is absent unless the provider
    // carries a log extension, which is why the console line exists too.
    it('reports every record it could not lift', async () => {
        const storage = await seeded(nestedAndTopLevel())
        const set = storage.set
        storage.set = (key, value) => {
            if (!key.startsWith('k/')) set(key, value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(logWarn).toHaveBeenCalledWith(
            expect.stringContaining('1 flat record(s) unlifted'),
            { entries: ['derived-1'] },
            PREFLIGHT_MODULE_ID,
        )
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('derived-1'),
        )
    })

    it('reports nothing when every record was taken', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        expect(logWarn).not.toHaveBeenCalled()
        expect(console.warn).not.toHaveBeenCalled()
    })

    // canary.13's `commit` wrote the id as a storage key, not necessarily as a
    // field, so a record can arrive without one. The driver reads every record
    // back at `k/<record.id>`, so the id has to be restated on the way into the
    // metadata bucket or the adopted record is unreachable.
    it('gives a record with no id field the id it was stored under', async () => {
        const storage = fakeStorage({})
        storage.set(
            'bare-1',
            await sealCanary13Record(subtle, MASTER_KEY, {
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                privateKey: OWN_SECRET,
                metadata: {
                    rootKey: {
                        id: 'root-1',
                        type: 'hd-root-key',
                        privateKey: ROOT_SECRET,
                    },
                },
            }),
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('bare-1')).toBeUndefined()
        expect(decode(storage.getString(`${METADATA_PREFIX}bare-1`)!).id).toBe(
            'bare-1',
        )
    })

    // Declining is a deliberate outcome, not a failure, so `up` resolves and
    // the runner marks the revision applied — it will never run again. Without
    // a note on disk the record is invisible forever.
    it('records a declined record in the durable sentinel', async () => {
        const storage = await seeded({
            id: 'key-c',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            privateKey: OWN_SECRET,
            metadata: {
                backup: {
                    label: 'paper',
                    privateKey: new Uint8Array(64).fill(13),
                },
            },
        })

        await migration.up(context(storage), utils())

        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual(['key-c'])
    })

    // A `failed` record needs the note more than a declined one: it stays flat,
    // upstream adopts it in the very next module, and its nested private key
    // reaches plaintext `k/`. A sentinel that only covered `declined` would
    // read as "nothing was left behind", which is worse than no sentinel.
    it('records a failed record in the durable sentinel', async () => {
        const storage = await seeded(nestedAndTopLevel())
        const set = storage.set
        storage.set = (key, value) => {
            if (!key.startsWith(METADATA_PREFIX)) set(key, value)
        }

        await migration.up(context(storage), utils())

        storage.set = set
        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual(['derived-1'])
    })

    it('records a record left flat for disagreeing with its storage key', async () => {
        const storage = fakeStorage({})
        storage.set(
            'storage-key-2',
            await sealCanary13Record(subtle, MASTER_KEY, {
                ...nestedAndTopLevel('a-different-id'),
            }),
        )

        await migration.up(context(storage), utils())

        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual(['storage-key-2'])
    })

    it('writes no sentinel when every record was taken', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        expect(
            createDeclinedRegister(noteStoreApi()).read(PREFLIGHT_MODULE_ID),
        ).toEqual([])
        expect(noteStore).toEqual({})
    })

    // The sentinel must never live in the keystore's own MMKV instance:
    // canary.19 mints the master key only while that store is literally empty,
    // so a note there would permanently block a fresh install.
    it('keeps the sentinel out of the keystore storage', async () => {
        const storage = await seeded({
            id: 'key-c',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            privateKey: OWN_SECRET,
            metadata: {
                backup: {
                    label: 'paper',
                    privateKey: new Uint8Array(64).fill(13),
                },
            },
        })
        const before = storage.entries()

        await migration.up(context(storage), utils())

        expect(storage.entries()).toEqual(before)
    })

    // Upstream zeroes the master key in a `finally`; a revision whose purpose
    // is keeping key bytes off disk must not leave them in the heap either.
    it('zeroes the master key it was handed', async () => {
        const storage = await seeded(nestedAndTopLevel())

        await migration.up(context(storage), utils())

        expect(lastMasterKey).toBeDefined()
        expect([...lastMasterKey!]).toEqual([...new Uint8Array(32)])
    })

    // The master key is not the only plaintext this revision holds: the record
    // it decrypts carries its own material and the HD root's, and both must be
    // gone from the heap once they are sealed.
    it('zeroes the record material it decrypted', async () => {
        const storage = await seeded(nestedAndTopLevel())
        resetDecoded()

        await migration.up(context(storage), utils())

        // The flat record is the first thing decoded; its arrays are the ones
        // `liftSecrets` pulled out and sealed.
        const flat = decodedRecords[0] as {
            privateKey?: Uint8Array
            metadata?: { rootKey?: { privateKey?: Uint8Array } }
        }
        expect([...flat.privateKey!]).toEqual([...new Uint8Array(32)])
        expect([...flat.metadata!.rootKey!.privateKey!]).toEqual([
            ...new Uint8Array(64),
        ])
    })

    // Declining and leaving-flat are exits too. A record that was decrypted and
    // then not taken still had every one of its secrets in the heap, so the
    // wipe has to cover the paths that return early, not just the adopt path.
    it.each([
        [
            'declined',
            {
                id: 'key-c',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                privateKey: OWN_SECRET,
                metadata: {
                    backup: { label: 'paper', privateKey: ROOT_SECRET },
                },
            },
            ['metadata', 'backup'],
        ],
        [
            'left flat because its material is only nested',
            nestedOnly('derived-9'),
            ['metadata', 'rootKey'],
        ],
        [
            'left flat because its id disagrees with its storage key',
            nestedAndTopLevel('a-different-id'),
            ['metadata', 'rootKey'],
        ],
    ] as const)(
        'zeroes the material of a record %s',
        async (_label, seed, path) => {
            const storage = fakeStorage({})
            storage.set(
                'flat-key',
                await sealCanary13Record(subtle, MASTER_KEY, { ...seed }),
            )
            resetDecoded()

            await migration.up(context(storage), utils())

            const carrier = path.reduce<Record<string, unknown>>(
                (node, step) => node[step] as Record<string, unknown>,
                decodedRecords[0] as unknown as Record<string, unknown>,
            )
            const secret = carrier.privateKey as Uint8Array
            expect([...secret]).toEqual([...new Uint8Array(secret.length)])
        },
    )

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('is idempotent', async () => {
        const storage = await seeded(nestedAndTopLevel())

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
