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
import { migration } from '../0005-url-safe-passkey-user-id'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../index'

const subtle = globalThis.crypto.subtle

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

const context = (
    storage: FakeKeychainStorage,
    platform: PeraMigrationContext['platform'] = 'android',
): PeraMigrationContext => ({
    storage,
    platform,
    subtle,
    masterKeyForRead: async () => {
        throw new Error(
            'masterKeyForRead should not be called by this revision',
        )
    },
    declined: createDeclinedRegister(noteStoreApi()),
})

const passkeyRecord = (id: string, metadata: Record<string, unknown>) => ({
    id,
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    metadata: { origin: 'github.com', ...metadata },
    version: 1,
})

const IOS_USER_ID = 'a+b/cw=='

const seed = (metadata: Record<string, unknown>) =>
    fakeStorage({
        [METADATA_PREFIX + 'cred-1']: serializeKey(
            passkeyRecord('cred-1', metadata),
        ),
    })

const metadataOf = (storage: FakeKeychainStorage) =>
    (
        decode(storage.getString(METADATA_PREFIX + 'cred-1')!) as {
            metadata: Record<string, unknown>
        }
    ).metadata

describe('0005-url-safe-passkey-user-id', () => {
    beforeEach(() => {
        noteStore = {}
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('rewrites a standard-base64 userId as unpadded base64url', async () => {
        const storage = seed({ userId: IOS_USER_ID, userHandle: 'alice' })

        await migration.up(context(storage), utils())

        expect(metadataOf(storage)).toMatchObject({
            userId: 'a-b_cw',
            userHandle: 'alice',
        })
    })

    it('rewrites a userHandle that fell back to the userId', async () => {
        const storage = seed({ userId: IOS_USER_ID, userHandle: IOS_USER_ID })

        await migration.up(context(storage), utils())

        expect(metadataOf(storage).userHandle).toBe('a-b_cw')
    })

    it('leaves a userId that is already base64url untouched', async () => {
        const storage = seed({ userId: 'a-b_cw', userHandle: 'alice' })
        const before = storage.getString(METADATA_PREFIX + 'cred-1')

        await migration.up(context(storage), utils())

        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBe(before)
    })

    it('does nothing on iOS, whose provider reads either alphabet', async () => {
        const storage = seed({ userId: IOS_USER_ID })

        await migration.up(context(storage, 'ios'), utils())

        expect(metadataOf(storage).userId).toBe(IOS_USER_ID)
    })

    it('ignores records that are not passkeys', async () => {
        const other = serializeKey({
            ...passkeyRecord('seed-1', { userId: IOS_USER_ID }),
            type: 'hd-root-key',
        })
        const storage = fakeStorage({ [METADATA_PREFIX + 'seed-1']: other })

        await migration.up(context(storage), utils())

        expect(storage.getString(METADATA_PREFIX + 'seed-1')).toBe(other)
    })

    it('survives an undecodable record', async () => {
        const storage = seed({ userId: IOS_USER_ID })
        storage.set(METADATA_PREFIX + 'junk', 'not-a-record')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(metadataOf(storage).userId).toBe('a-b_cw')
    })

    it('is idempotent', async () => {
        const storage = seed({ userId: IOS_USER_ID, userHandle: IOS_USER_ID })

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
