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
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// See 0002-lift-nested-material.spec.ts for why the package root is mocked and
// why the prefix and `serializeKey` still come from the driver's real dist
// while `decode` cannot: this revision never touches material, so nothing
// here needs `sealData`/`openData`/`MasterKeyNotFoundError`.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const formats = await import('../../__fixtures__/keystoreFormats')

    return {
        METADATA_PREFIX: driver.METADATA_PREFIX,
        serializeKey: driver.serializeKey,
        decode: formats.decode,
    }
})

import {
    METADATA_PREFIX,
    decode,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import { createDeclinedRegister } from '../../declined'
import { migration } from '../0004-stamp-quantum-derivation'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../index'

const subtle = globalThis.crypto.subtle

/** Stands in for the migrations ledger's MMKV instance. */
let noteStore: Record<string, string>

const noteStoreApi = () => ({
    getString: (key: string) => noteStore[key],
    set: (key: string, value: string) => {
        noteStore[key] = value
    },
})

const utils = (): MigrationUtils => ({
    revision: {
        module: REPAIRS_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
})

/**
 * A `masterKeyForRead` that throws by default: this revision must decide from
 * the plaintext `k/` bucket alone, so any test that doesn't override it should
 * fail loudly rather than silently handing out a key.
 */
const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: async () => {
        throw new Error(
            'masterKeyForRead should not be called by this revision',
        )
    },
    declined: createDeclinedRegister(noteStoreApi()),
})

const falconRecord = (id: string, metadata: Record<string, unknown> = {}) => ({
    id,
    type: 'falcon-1024',
    algorithm: 'Falcon-1024',
    extractable: false,
    keyUsages: ['sign', 'verify'],
    metadata: { storage: 'bytes', parentKeyId: 'seed-1', ...metadata },
    version: 1,
})

describe('0004-stamp-quantum-derivation', () => {
    beforeEach(() => {
        noteStore = {}
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('stamps an unmarked falcon child as legacy', async () => {
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-1-quantum']: serializeKey(
                falconRecord('seed-1-quantum'),
            ),
        })

        await migration.up(context(storage), utils())

        const record = decode(
            storage.getString(METADATA_PREFIX + 'seed-1-quantum')!,
        ) as { metadata: { pqDerivation?: string } }
        expect(record.metadata.pqDerivation).toBe('legacy')
    })

    it('leaves an already-marked child untouched', async () => {
        // Idempotence. The revision ledger should prevent a second run, but a
        // canonical child minted after this revision must never be downgraded.
        const marked = serializeKey(
            falconRecord('seed-2-quantum-pqk1', { pqDerivation: 'pqk1' }),
        )
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-2-quantum-pqk1']: marked,
        })

        await migration.up(context(storage), utils())

        expect(storage.getString(METADATA_PREFIX + 'seed-2-quantum-pqk1')).toBe(
            marked,
        )
    })

    it('ignores non-falcon records', async () => {
        const ed25519 = serializeKey({
            id: 'seed-3-ed25519',
            type: 'ed25519',
            algorithm: 'EdDSA',
            extractable: false,
            keyUsages: ['sign'],
            metadata: { storage: 'bytes' },
            version: 1,
        })
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-3-ed25519']: ed25519,
        })

        await migration.up(context(storage), utils())

        expect(storage.getString(METADATA_PREFIX + 'seed-3-ed25519')).toBe(
            ed25519,
        )
    })

    it('does not request the master key', async () => {
        // A metadata-only pass must never raise a biometric prompt at boot.
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-1-quantum']: serializeKey(
                falconRecord('seed-1-quantum'),
            ),
        })
        const ctx = context(storage)
        let asked = false
        ctx.masterKeyForRead = async () => {
            asked = true
            return new Uint8Array(32)
        }

        await migration.up(ctx, utils())

        expect(asked).toBe(false)
    })

    it('survives an undecodable record', async () => {
        const storage = fakeStorage({
            [METADATA_PREFIX + 'junk']: 'not-a-record',
            [METADATA_PREFIX + 'seed-1-quantum']: serializeKey(
                falconRecord('seed-1-quantum'),
            ),
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        const record = decode(
            storage.getString(METADATA_PREFIX + 'seed-1-quantum')!,
        ) as { metadata: { pqDerivation?: string } }
        expect(record.metadata.pqDerivation).toBe('legacy')
    })

    it('is idempotent', async () => {
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-1-quantum']: serializeKey(
                falconRecord('seed-1-quantum'),
            ),
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
            validateMigrations(repairsMigrations, REPAIRS_MODULE_ID),
        ).not.toThrow()
    })
})
