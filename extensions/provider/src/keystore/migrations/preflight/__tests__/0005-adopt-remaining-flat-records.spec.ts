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
import { validateMigrations } from '@algorandfoundation/provider-migrations'

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

import { fakeStorage } from '../../__fixtures__/fakeStorage'
import { createDeclinedRegister } from '../../declined'
import { migration } from '../0005-adopt-remaining-flat-records'
import { preflightMigrations } from '../index'

const subtle = globalThis.crypto.subtle

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
})
