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

import { describe, expect, it, vi } from 'vitest'
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// The package root executes native Keychain/Nitro bindings at import time,
// which jsdom can't run, and vitest can't intercept a mock inside an
// externalised dependency's own graph — so every spec here mocks the whole
// module (see createKeystore.spec.ts, singleton.test.ts). The prefixes are
// what this revision's key filtering turns on, so they are re-exported from
// the driver's real dist module rather than restated: an upstream change to
// either string still breaks this test. The path is relative because the
// package's `exports` map publishes only `.`.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    return {
        MATERIAL_PREFIX: driver.MATERIAL_PREFIX,
        METADATA_PREFIX: driver.METADATA_PREFIX,
    }
})

import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import { migration } from '../0001-retire-hd-root-shadow'
import { PREFLIGHT_MODULE_ID, preflightMigrations } from '../index'

const ROOT_ID = 'root-1'

const utils = (): MigrationUtils => ({
    revision: {
        module: PREFLIGHT_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
})

/**
 * Both material-touching members throw: this revision must decide from the
 * plaintext `k/` record alone, and any read of the master key at launch is a
 * biometric prompt the user cannot explain.
 */
const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    get subtle(): SubtleCrypto {
        throw new Error('the preflight revision must not decrypt anything')
    },
    masterKeyForRead: () => {
        throw new Error('the preflight revision must not read the master key')
    },
})

const seeded = (): FakeKeychainStorage =>
    fakeStorage({
        [`k/${ROOT_ID}`]: JSON.stringify({
            id: ROOT_ID,
            type: 'hd-root-key',
            algorithm: 'raw',
            publicKey: { $u8: 'AAAA' },
            metadata: { scheme: 'bip32-ed25519', storage: 'bytes' },
        }),
        [`m/${ROOT_ID}`]: '{"iv":"aXY=","content":"Y3Q="}',
        [ROOT_ID]: '{"iv":"aXY=","tag":"dGc=","content":"Y3Q="}',
    })

describe('0001-retire-hd-root-shadow', () => {
    it('removes the bare-id shadow when the split pair is present', async () => {
        const storage = seeded()

        await migration.up(context(storage), utils())

        expect(storage.getString(ROOT_ID)).toBeUndefined()
    })

    it('leaves the split metadata untouched', async () => {
        const storage = seeded()
        const before = storage.getString(`k/${ROOT_ID}`)

        await migration.up(context(storage), utils())

        expect(storage.getString(`k/${ROOT_ID}`)).toBe(before)
    })

    it('leaves the flat record alone when its split pair is incomplete', async () => {
        // Upstream's 0002 must still get a chance to adopt it; deleting here
        // would destroy the only copy.
        const storage = seeded()
        storage.remove(`m/${ROOT_ID}`)

        await migration.up(context(storage), utils())

        expect(storage.getString(ROOT_ID)).toBeDefined()
    })

    it('ignores flat records that are not HD roots', async () => {
        const storage = seeded()
        storage.set(
            'some-credential',
            '{"iv":"aXY=","tag":"dGc=","content":"Y3Q="}',
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('some-credential')).toBeDefined()
    })

    // The case above is filtered out before the type check ever runs (it has no
    // `k/` sibling), so exercise the type set against a record that reaches it.
    it('ignores a complete pair whose type is not an HD root', async () => {
        const storage = seeded()
        storage.set(
            'k/passkey-1',
            JSON.stringify({ id: 'passkey-1', type: 'passkey' }),
        )
        storage.set('m/passkey-1', '{"iv":"aXY=","content":"Y3Q="}')
        storage.set('passkey-1', '{"iv":"aXY=","tag":"dGc=","content":"Y3Q="}')

        await migration.up(context(storage), utils())

        expect(storage.getString('passkey-1')).toBeDefined()
    })

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        // `up` is synchronous, so it is wrapped rather than awaited directly;
        // the assertion is still that it neither throws nor returns a value.
        await expect(
            Promise.resolve(migration.up(context(storage), utils())),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
    })

    it('is idempotent', async () => {
        await assertIdempotent({
            migration,
            context: () => context(seeded()),
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
