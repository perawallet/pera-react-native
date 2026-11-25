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

vi.mock('react-native-quick-crypto', () => ({
    subtle: globalThis.crypto.subtle,
    randomBytes: (size: number) =>
        globalThis.crypto.getRandomValues(new Uint8Array(size)),
}))

const readMasterKey = vi.hoisted(() => vi.fn())

// The package root still loads the native engine, so it is mocked; every
// primitive the migrations use comes from its real dist. The vitest config
// inlines the package and stubs its Keychain/MMKV imports so `crypto.js` and
// `state.js` load off device.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const dist =
        '../../../node_modules/@algorandfoundation/react-native-keystore/dist'
    const driver = await import(`${dist}/storage/driver.js`)
    const errors = await import(`${dist}/errors.js`)
    const crypto = await import(`${dist}/storage/crypto.js`)
    const state = await import(`${dist}/storage/state.js`)

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        MasterKeyNotFoundError: errors.MasterKeyNotFoundError,
        sealData: crypto.sealData,
        openData: crypto.openData,
        decode: state.decode,
        readMasterKey,
        storage: {},
    }
})

import { readFileSync } from 'node:fs'
import {
    MigrationFailedError,
    WithMigrations,
    memoryLedger,
    type MigrationLedger,
    type MigrationsApi,
} from '@algorandfoundation/provider-migrations'
import {
    METADATA_PREFIX,
    decode,
} from '@algorandfoundation/react-native-keystore'
import { migrations as upstreamMigrations } from '../../../node_modules/@algorandfoundation/react-native-keystore/dist/migrations/index.js'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../migrations/__fixtures__/fakeStorage'
import { sealCanary13Record } from '../migrations/__fixtures__/keystoreFormats'
import { SECRET_FIELDS } from '../migrations/canary13'
import { PREFLIGHT_MODULE_ID } from '../migrations/preflight'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../migrations/repairs'
import { UPSTREAM_KEYSTORE_MODULE_ID } from '../keystoreMigrationModules'
import {
    KeystorePreflightIncompleteError,
    WithPeraKeystorePreflight,
} from '../withPeraKeystorePreflight'
import { WithPeraKeystoreRepairs } from '../withPeraKeystoreRepairs'

const MASTER_KEY = new Uint8Array(32).fill(7)

/** Material at the top level and under `metadata.rootKey`: what 0002 lifts. */
const nestedAndTopLevel = {
    id: 'derived-1',
    type: 'hd-derived-ed25519',
    algorithm: 'EdDSA',
    extractable: false,
    privateKey: new Uint8Array(32).fill(1),
    publicKey: new Uint8Array(32).fill(4),
    metadata: {
        parentKeyId: 'root-1',
        rootKey: {
            id: 'root-1',
            type: 'hd-root-key',
            privateKey: new Uint8Array(64).fill(11),
        },
    },
}

const LATER_MODULE_ID = 'test/later-module'

const downstream = {
    flagPasskeys: vi.fn(),
    adopt: vi.fn(),
    repairs: vi.fn(),
    later: vi.fn(),
}

const registerLaterModule = (migrations: MigrationsApi) =>
    migrations.register({
        module: LATER_MODULE_ID,
        context: async () => ({}),
        migrations: [{ id: 1, name: 'later', up: downstream.later }],
    })

const createProvider = (ledger: MigrationLedger) =>
    WithMigrations({}, { migrations: { ledger, autoRun: false } }) as {
        migrations: MigrationsApi
    }

/** One app launch: preflight plus stand-ins for the modules after it. */
const launch = (storage: FakeKeychainStorage, ledger?: MigrationLedger) => {
    const provider = createProvider(ledger ?? memoryLedger())
    WithPeraKeystorePreflight(provider, {
        keystore: { storage },
        ...(ledger && { migrations: { ledger } }),
    })
    provider.migrations.register({
        module: UPSTREAM_KEYSTORE_MODULE_ID,
        context: async () => ({}),
        migrations: [
            {
                id: 1,
                name: 'flag-legacy-passkeys',
                up: downstream.flagPasskeys,
            },
            {
                id: 2,
                name: 'adopt-flat-records',
                up: () => {
                    downstream.adopt()
                    storage.set('test/adoption-ran', 'true')
                },
            },
        ],
    })
    provider.migrations.register({
        module: REPAIRS_MODULE_ID,
        context: async () => ({}),
        migrations: [{ id: 1, name: 'repair', up: downstream.repairs }],
    })
    registerLaterModule(provider.migrations)
    return provider.migrations.run()
}

/**
 * One app launch through the real preflight, upstream and repairs modules.
 * Upstream is registered the way `WithKeyStore` does, without the engine it
 * would also build.
 */
const launchReal = (storage: FakeKeychainStorage, ledger: MigrationLedger) => {
    const provider = createProvider(ledger)
    WithPeraKeystorePreflight(provider, {
        keystore: { storage },
        migrations: { ledger },
    })
    provider.migrations.register({
        module: UPSTREAM_KEYSTORE_MODULE_ID,
        context: () => ({
            storage,
            subtle: globalThis.crypto.subtle,
            masterKeyForRead: () => readMasterKey(),
        }),
        migrations: upstreamMigrations,
    })
    WithPeraKeystoreRepairs(
        {
            ...provider,
            deviceInfo: { getDevicePlatform: () => 'android' },
        },
        { keystore: { storage } },
    )
    registerLaterModule(provider.migrations)
    return provider.migrations.run()
}

const seal = (record: Record<string, unknown>) =>
    sealCanary13Record(globalThis.crypto.subtle, MASTER_KEY, record)

const secretPathsIn = (value: unknown, path: string): string[] => {
    if (value instanceof Uint8Array || value === null) return []
    if (typeof value !== 'object') return []
    return Object.entries(value as Record<string, unknown>).flatMap(
        ([field, nested]) =>
            SECRET_FIELDS.has(field)
                ? [`${path}.${field}`]
                : secretPathsIn(nested, `${path}.${field}`),
    )
}

/** Every secret field readable from plaintext `k/` metadata. */
const secretsInMetadata = (storage: FakeKeychainStorage): string[] =>
    storage
        .getAllKeys()
        .filter(key => key.startsWith(METADATA_PREFIX))
        .flatMap(key => secretPathsIn(decode(storage.getString(key)!), key))

const failedModules = (failure: unknown) =>
    (failure as MigrationFailedError).report.failed

describe('keystore preflight gate', () => {
    let storage: FakeKeychainStorage
    let ledger: MigrationLedger

    beforeEach(async () => {
        vi.clearAllMocks()
        readMasterKey.mockImplementation(async () => MASTER_KEY.slice())
        ledger = memoryLedger()
        storage = fakeStorage({})
        storage.set(nestedAndTopLevel.id, await seal(nestedAndTopLevel))
    })

    it('holds adoption and repairs back for the launch when preflight cannot read the master key', async () => {
        readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))

        const failure = await launch(storage, ledger).catch(
            (error: unknown) => error,
        )

        expect(failure).toBeInstanceOf(MigrationFailedError)
        const failed = failedModules(failure)
        expect(failed.map(entry => entry.module)).toEqual([
            PREFLIGHT_MODULE_ID,
            UPSTREAM_KEYSTORE_MODULE_ID,
            REPAIRS_MODULE_ID,
        ])
        expect(failed[1].error).toBeInstanceOf(KeystorePreflightIncompleteError)
        expect(failed[2].error).toBeInstanceOf(KeystorePreflightIncompleteError)
        expect(downstream.adopt).not.toHaveBeenCalled()
        expect(downstream.repairs).not.toHaveBeenCalled()
        expect(storage.getString('test/adoption-ran')).toBeUndefined()
        expect(storage.getString(nestedAndTopLevel.id)).toBeDefined()
        expect(downstream.flagPasskeys).toHaveBeenCalledOnce()
        expect(downstream.later).toHaveBeenCalledOnce()
        const state = await ledger.read()
        expect(state[UPSTREAM_KEYSTORE_MODULE_ID]?.id).toBe(1)
        expect(state[REPAIRS_MODULE_ID]).toBeUndefined()
        expect(state[LATER_MODULE_ID]?.id).toBe(1)
    })

    it('runs adoption, then repairs, on the next launch once preflight can read the key', async () => {
        readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))
        await launch(storage, ledger).catch(() => undefined)

        await launch(storage, ledger)

        expect(downstream.adopt).toHaveBeenCalledOnce()
        expect(downstream.repairs).toHaveBeenCalledOnce()
        expect(downstream.adopt.mock.invocationCallOrder[0]).toBeLessThan(
            downstream.repairs.mock.invocationCallOrder[0],
        )
        expect(storage.getString(nestedAndTopLevel.id)).toBeUndefined()
    })

    it('holds repairs back whenever adoption fails, not only behind preflight', async () => {
        downstream.adopt.mockImplementationOnce(() => {
            throw new Error('adoption failed')
        })

        const failure = await launch(storage, ledger).catch(
            (error: unknown) => error,
        )

        const failed = failedModules(failure)
        expect(failed.map(entry => entry.module)).toEqual([
            UPSTREAM_KEYSTORE_MODULE_ID,
            REPAIRS_MODULE_ID,
        ])
        expect(downstream.repairs).not.toHaveBeenCalled()
        expect(downstream.later).toHaveBeenCalledOnce()
    })

    it('does not block boot or other modules on a record preflight declines', async () => {
        storage.remove(nestedAndTopLevel.id)
        storage.set('derived-2', await seal(nestedAndTopLevel))

        await launch(storage, ledger)

        expect(storage.getString('derived-2')).toBeDefined()
        expect(downstream.adopt).toHaveBeenCalledOnce()
        expect(downstream.repairs).toHaveBeenCalledOnce()
    })

    it('keys on the module id and revision name upstream registers', () => {
        const dist = new URL(
            '../../../node_modules/@algorandfoundation/react-native-keystore/dist/',
            import.meta.url,
        )

        expect(readFileSync(new URL('extension.js', dist), 'utf8')).toContain(
            `module: "${UPSTREAM_KEYSTORE_MODULE_ID}"`,
        )
        expect(upstreamMigrations.map(migration => migration.name)).toContain(
            'adopt-flat-records',
        )
    })

    describe('with the real upstream and repairs modules', () => {
        it('adopts and repairs on the launch after a failed master-key read, with no root key in k/', async () => {
            readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))

            const failure = await launchReal(storage, ledger).catch(
                (error: unknown) => error,
            )

            const failed = failedModules(failure)
            expect(failed.map(entry => entry.module)).toEqual([
                PREFLIGHT_MODULE_ID,
                UPSTREAM_KEYSTORE_MODULE_ID,
                REPAIRS_MODULE_ID,
            ])
            expect(failed[2].error).toBeInstanceOf(
                KeystorePreflightIncompleteError,
            )
            const held = await ledger.read()
            expect(held[UPSTREAM_KEYSTORE_MODULE_ID]?.id).toBe(1)
            expect(held[REPAIRS_MODULE_ID]).toBeUndefined()
            expect(downstream.later).toHaveBeenCalledOnce()
            expect(storage.getString(nestedAndTopLevel.id)).toBeDefined()
            expect(secretsInMetadata(storage)).toEqual([])

            await launchReal(storage, ledger)

            const done = await ledger.read()
            expect(done[UPSTREAM_KEYSTORE_MODULE_ID]?.id).toBe(
                upstreamMigrations.at(-1)!.id,
            )
            expect(done[REPAIRS_MODULE_ID]?.id).toBe(
                repairsMigrations.at(-1)!.id,
            )
            expect(storage.getString(nestedAndTopLevel.id)).toBeUndefined()
            expect(
                storage.getString(`${METADATA_PREFIX}${nestedAndTopLevel.id}`),
            ).toBeDefined()
            expect(secretsInMetadata(storage)).toEqual([])
        })
    })
})
