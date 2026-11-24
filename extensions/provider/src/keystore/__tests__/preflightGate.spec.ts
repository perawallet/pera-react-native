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
}))

const readMasterKey = vi.hoisted(() => vi.fn())

// See `migrations/preflight/__tests__/0002-lift-nested-material.spec.ts` for
// why the package root is mocked and what still comes from its real dist.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../migrations/__fixtures__/keystoreFormats')

    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        MasterKeyNotFoundError: errors.MasterKeyNotFoundError,
        sealData: formats.sealData,
        openData: formats.openData,
        decode: formats.decode,
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
    fakeStorage,
    type FakeKeychainStorage,
} from '../migrations/__fixtures__/fakeStorage'
import { sealCanary13Record } from '../migrations/__fixtures__/keystoreFormats'
import { PREFLIGHT_MODULE_ID } from '../migrations/preflight'
import { REPAIRS_MODULE_ID } from '../migrations/repairs'
import { UPSTREAM_KEYSTORE_MODULE_ID } from '../keystoreMigrationModules'
import {
    KeystorePreflightIncompleteError,
    WithPeraKeystorePreflight,
} from '../withPeraKeystorePreflight'

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

const downstream = {
    flagPasskeys: vi.fn(),
    adopt: vi.fn(),
    repairs: vi.fn(),
}

/** One app launch: preflight plus stand-ins for the two modules after it. */
const launch = (storage: FakeKeychainStorage, ledger?: MigrationLedger) => {
    const runnerLedger = ledger ?? memoryLedger()
    const provider = WithMigrations(
        {},
        { migrations: { ledger: runnerLedger, autoRun: false } },
    ) as { migrations: MigrationsApi }
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
    return provider.migrations.run()
}

const seal = (record: Record<string, unknown>) =>
    sealCanary13Record(globalThis.crypto.subtle, MASTER_KEY, record)

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

    it('holds only adoption back for the launch when preflight cannot read the master key', async () => {
        readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))

        const failure = await launch(storage, ledger).catch(
            (error: unknown) => error,
        )

        expect(failure).toBeInstanceOf(MigrationFailedError)
        const failed = (failure as MigrationFailedError).report.failed
        expect(failed.map(entry => entry.module)).toEqual([
            PREFLIGHT_MODULE_ID,
            UPSTREAM_KEYSTORE_MODULE_ID,
        ])
        expect(failed[1].error).toBeInstanceOf(KeystorePreflightIncompleteError)
        expect(downstream.adopt).not.toHaveBeenCalled()
        expect(storage.getString('test/adoption-ran')).toBeUndefined()
        expect(storage.getString(nestedAndTopLevel.id)).toBeDefined()
        expect(downstream.flagPasskeys).toHaveBeenCalledOnce()
        expect(downstream.repairs).toHaveBeenCalledOnce()
        expect((await ledger.read())[UPSTREAM_KEYSTORE_MODULE_ID]?.id).toBe(1)
    })

    it('runs adoption on the next launch once preflight can read the key', async () => {
        readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))
        await launch(storage, ledger).catch(() => undefined)

        await launch(storage, ledger)

        expect(downstream.adopt).toHaveBeenCalledOnce()
        expect(storage.getString(nestedAndTopLevel.id)).toBeUndefined()
    })

    it('does not block boot or other modules on a record preflight declines', async () => {
        storage.remove(nestedAndTopLevel.id)
        storage.set('derived-2', await seal(nestedAndTopLevel))

        await launch(storage, ledger)

        expect(storage.getString('derived-2')).toBeDefined()
        expect(downstream.adopt).toHaveBeenCalledOnce()
        expect(downstream.repairs).toHaveBeenCalledOnce()
    })

    it('does not gate adoption when no ledger is provided', async () => {
        readMasterKey.mockRejectedValueOnce(new Error('keychain busy'))

        await launch(storage).catch(() => undefined)

        expect(downstream.adopt).toHaveBeenCalledOnce()
    })

    it('keys on the module id and revision name upstream registers', () => {
        const dist = new URL(
            '../../../node_modules/@algorandfoundation/react-native-keystore/dist/',
            import.meta.url,
        )

        expect(readFileSync(new URL('extension.js', dist), 'utf8')).toContain(
            `module: "${UPSTREAM_KEYSTORE_MODULE_ID}"`,
        )
        expect(
            readFileSync(
                new URL('migrations/0002-adopt-flat-records.js', dist),
                'utf8',
            ),
        ).toContain('name: "adopt-flat-records"')
    })
})
