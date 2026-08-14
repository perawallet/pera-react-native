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

import { MasterKeyNotFoundError } from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import {
    decode,
    openData,
    sealCanary13Record,
} from '../../__fixtures__/keystoreFormats'
import { SECRET_FIELDS } from '../../canary13'
import { migration } from '../0002-lift-nested-material'
import { PREFLIGHT_MODULE_ID, preflightMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

const ROOT_SECRET = new Uint8Array(64).fill(11)
const OWN_SECRET = new Uint8Array(32).fill(1)

const utils = (): MigrationUtils => ({
    revision: {
        module: PREFLIGHT_MODULE_ID,
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
        masterKeyForRead = vi.fn(async () => MASTER_KEY)
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
