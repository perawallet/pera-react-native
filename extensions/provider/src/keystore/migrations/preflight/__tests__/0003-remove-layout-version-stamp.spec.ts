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
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// This spec only exercises the sync stamp-removal revision, but importing
// `../index` also loads its siblings (0002, 0004), which import the real
// package at module scope — see 0001-retire-hd-root-shadow.spec.ts for why
// that has to be mocked before anything under `../` is imported.
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

import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import {
    LAYOUT_VERSION_KEY,
    migration,
} from '../0003-remove-layout-version-stamp'
import { PREFLIGHT_MODULE_ID, preflightMigrations } from '../index'

const utils = (): MigrationUtils => ({
    revision: {
        module: PREFLIGHT_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
})

/**
 * Both material-touching members throw: a stale marker's mere presence is
 * enough to decide, so any read of the master key at launch would be an
 * unexplained biometric prompt.
 */
const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    get subtle(): SubtleCrypto {
        throw new Error('this revision must not decrypt anything')
    },
    masterKeyForRead: () => {
        throw new Error('this revision must not read the master key')
    },
    declined: { read: () => [], record: () => {} },
})

describe('0003-remove-layout-version-stamp', () => {
    // The unrecoverable case: canary.19 mints its master key only while the
    // keystore MMKV is literally empty, so a lone stamp blocks the first
    // write forever. This is what makes the empty case worth its own test
    // rather than folding into the general "removes the stamp" one below.
    it('clears a stamp left on an otherwise-empty store', async () => {
        const storage = fakeStorage({ [LAYOUT_VERSION_KEY]: '1' })

        await Promise.resolve(migration.up(context(storage), utils()))

        expect(storage.entries()).toEqual({})
    })

    it('removes the stamp from a populated store, leaving other entries alone', async () => {
        const storage = fakeStorage({
            [LAYOUT_VERSION_KEY]: '1',
            'k/key-1': JSON.stringify({ id: 'key-1', type: 'ed25519' }),
        })

        await Promise.resolve(migration.up(context(storage), utils()))

        expect(storage.getString(LAYOUT_VERSION_KEY)).toBeUndefined()
        expect(storage.getString('k/key-1')).toBeDefined()
    })

    it('is a no-op on a store that never had the stamp', async () => {
        const storage = fakeStorage({
            'k/key-1': JSON.stringify({ id: 'key-1', type: 'ed25519' }),
        })
        const before = storage.entries()

        await Promise.resolve(migration.up(context(storage), utils()))

        expect(storage.entries()).toEqual(before)
    })

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        await expect(
            Promise.resolve(migration.up(context(storage), utils())),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
    })

    it('is idempotent', async () => {
        await assertIdempotent({
            migration,
            context: () =>
                context(
                    fakeStorage({
                        [LAYOUT_VERSION_KEY]: '1',
                        'k/key-1': JSON.stringify({ id: 'key-1' }),
                    }),
                ),
            snapshot: ({ storage }) =>
                (storage as FakeKeychainStorage).entries(),
        })
    })

    it('has a valid manifest', () => {
        expect(() =>
            validateMigrations(preflightMigrations, PREFLIGHT_MODULE_ID),
        ).not.toThrow()
    })
})
