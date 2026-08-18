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

import { describe, expect, it, vi } from 'vitest'
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'

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

// Defaults to the real implementation (via `importActual`) so the spec-shape
// and never-throw tests below still exercise real adoption logic end to end.
// Individual tests override it with `mockImplementationOnce`/
// `mockResolvedValueOnce` to control exactly what `0005` sees, since that
// logic (classification, quarantine, per-record failure) is already covered
// by `adopt/__tests__/strandedRecords.spec.ts` — these tests are about what
// the *revision* does with the result.
vi.mock('../../adopt/strandedRecords', async () => {
    const actual = await vi.importActual<
        typeof import('../../adopt/strandedRecords')
    >('../../adopt/strandedRecords')
    return {
        ...actual,
        adoptStrandedRecords: vi.fn(actual.adoptStrandedRecords),
    }
})

import type { PeraMigrationContext } from '../../types'
import { fakeStorage } from '../../__fixtures__/fakeStorage'
import { createDeclinedRegister } from '../../declined'
import {
    adoptStrandedRecords,
    emptyAdoptionResult,
} from '../../adopt/strandedRecords'
import { migration } from '../0005-adopt-remaining-flat-records'
import { preflightMigrations } from '../index'

const subtle = globalThis.crypto.subtle

/** Stands in for the migrations ledger's MMKV instance. */
const noteStoreDeclined = (store: Record<string, string>) =>
    createDeclinedRegister({
        getString: key => store[key],
        set: (key, value) => {
            store[key] = value
        },
    })

const utils = (log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }) =>
    ({
        revision: { module: 'test-module', id: 5, name: migration.name },
        secrets: createSecretScratch().scratch,
        log,
    }) as MigrationUtils

describe('0005-adopt-remaining-flat-records', () => {
    it('is registered last, ascending', () => {
        expect(migration.id).toBe(5)
        expect(preflightMigrations.at(-1)).toBe(migration)
        expect(() => validateMigrations(preflightMigrations)).not.toThrow()
    })

    it('resolves rather than throwing when the master key is unreadable', async () => {
        const storage = fakeStorage()
        storage.set('some-record', 'not-a-record')

        await expect(
            migration.up(
                {
                    storage,
                    subtle,
                    masterKeyForRead: async () => {
                        throw new Error('keychain unavailable')
                    },
                    declined: createDeclinedRegister({
                        getString: () => undefined,
                        set: () => {},
                    }),
                } as never,
                { revision: { module: 'test' } } as never,
            ),
        ).resolves.toBeUndefined()
    })

    // `adoptStrandedRecords` is not throw-proof: a journal rollback issues its
    // own storage writes, and several storage calls sit outside any per-record
    // `try`. A throw escaping `up` rejects `migrations.ready` → `keystore.ready`
    // and blocks boot on every launch.
    it('resolves rather than throwing when adoption itself throws', async () => {
        vi.mocked(adoptStrandedRecords).mockRejectedValueOnce(
            new Error('simulated storage failure'),
        )
        const logWarn = vi.fn()

        await expect(
            migration.up(
                {
                    storage: fakeStorage(),
                    subtle,
                    masterKeyForRead: async () => new Uint8Array(32),
                    declined: noteStoreDeclined({}),
                } as PeraMigrationContext,
                utils({ info: vi.fn(), warn: logWarn, error: vi.fn() }),
            ),
        ).resolves.toBeUndefined()

        expect(logWarn).toHaveBeenCalledTimes(1)
    })

    it('records leftFlat, failed, and quarantined ids as declined and warns', async () => {
        vi.mocked(adoptStrandedRecords).mockResolvedValueOnce({
            ...emptyAdoptionResult(),
            quarantined: [{ id: 'root-legacy', legacyId: 'root-legacy-orig' }],
            leftFlat: ['cred-2'],
            failed: [{ id: 'bad-1', reason: 'boom' }],
        })

        const noteStore: Record<string, string> = {}
        const logWarn = vi.fn()

        await migration.up(
            {
                storage: fakeStorage(),
                subtle,
                masterKeyForRead: async () => new Uint8Array(32),
                declined: noteStoreDeclined(noteStore),
            } as PeraMigrationContext,
            utils({ info: vi.fn(), warn: logWarn, error: vi.fn() }),
        )

        expect(noteStoreDeclined(noteStore).read('test-module').sort()).toEqual(
            ['bad-1', 'cred-2', 'root-legacy'].sort(),
        )
        expect(logWarn).toHaveBeenCalledTimes(1)
    })

    it('records nothing and does not warn when nothing was left behind', async () => {
        vi.mocked(adoptStrandedRecords).mockResolvedValueOnce(
            emptyAdoptionResult(),
        )

        const noteStore: Record<string, string> = {}
        const logWarn = vi.fn()

        await migration.up(
            {
                storage: fakeStorage(),
                subtle,
                masterKeyForRead: async () => new Uint8Array(32),
                declined: noteStoreDeclined(noteStore),
            } as PeraMigrationContext,
            utils({ info: vi.fn(), warn: logWarn, error: vi.fn() }),
        )

        expect(noteStoreDeclined(noteStore).read('test-module')).toEqual([])
        expect(logWarn).not.toHaveBeenCalled()
    })

    it('routes a read master key through utils.secrets so the engine wipes it', async () => {
        vi.mocked(adoptStrandedRecords).mockImplementationOnce(async deps => {
            await deps.masterKeyForRead()
            return emptyAdoptionResult()
        })

        const put = vi.fn()
        const wipe = vi.fn()
        const masterKey = new Uint8Array(32).fill(9)

        await migration.up(
            {
                storage: fakeStorage(),
                subtle,
                masterKeyForRead: async () => masterKey,
                declined: noteStoreDeclined({}),
            } as PeraMigrationContext,
            {
                revision: {
                    module: 'test-module',
                    id: 5,
                    name: migration.name,
                },
                secrets: {
                    put,
                    wipe,
                    use: async (
                        _label: string,
                        fn: (b: Uint8Array) => unknown,
                    ) => fn(new Uint8Array()),
                    has: () => true,
                    toJSON: () => '[SecretScratch]',
                },
                log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            } as MigrationUtils,
        )

        // Reference identity, not `expect.any(Uint8Array)`: the scratch has to
        // own the array the runner will zero. Handing it `masterKey.slice()`
        // would leave the real key resident in the heap and still satisfy a
        // shape or deep-equality assertion.
        expect(put).toHaveBeenCalledTimes(1)
        expect(put.mock.calls[0][0]).toBe('keystore-master-key')
        expect(put.mock.calls[0][1]).toBe(masterKey)
        expect(wipe).toHaveBeenCalledWith('keystore-master-key')
    })

    it('never puts or wipes the master key when nothing reads it', async () => {
        vi.mocked(adoptStrandedRecords).mockResolvedValueOnce(
            emptyAdoptionResult(),
        )

        const put = vi.fn()
        const wipe = vi.fn()

        await migration.up(
            {
                storage: fakeStorage(),
                subtle,
                masterKeyForRead: async () => new Uint8Array(32),
                declined: noteStoreDeclined({}),
            } as PeraMigrationContext,
            {
                revision: {
                    module: 'test-module',
                    id: 5,
                    name: migration.name,
                },
                secrets: {
                    put,
                    wipe,
                    use: async (
                        _label: string,
                        fn: (b: Uint8Array) => unknown,
                    ) => fn(new Uint8Array()),
                    has: () => true,
                    toJSON: () => '[SecretScratch]',
                },
                log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
            } as MigrationUtils,
        )

        expect(put).not.toHaveBeenCalled()
        expect(wipe).not.toHaveBeenCalled()
    })
})
