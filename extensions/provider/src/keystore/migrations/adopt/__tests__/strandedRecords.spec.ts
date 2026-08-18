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

// See 0002-lift-nested-material.spec.ts for why the package root is mocked and
// why the prefixes and `serializeKey` still come from its real dist while
// `sealData`/`openData`/`decode` cannot.
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
    MATERIAL_PREFIX,
    METADATA_PREFIX,
} from '@algorandfoundation/react-native-keystore'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import { openData, sealCanary13Record } from '../../__fixtures__/keystoreFormats'
import { adoptStrandedRecords, hasStrandedWork } from '../strandedRecords'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

let storage: FakeKeychainStorage

const deps = () => ({
    storage,
    subtle,
    masterKeyForRead: async () => MASTER_KEY,
})

const seed = async (record: object) => {
    storage.set(
        (record as { id: string }).id,
        await sealCanary13Record(subtle, MASTER_KEY, record),
    )
}

beforeEach(() => {
    storage = fakeStorage()
})

describe('adoptStrandedRecords — material-bearing records', () => {
    const root = {
        id: 'root-1',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: new Uint8Array(96).fill(9),
        metadata: { scheme: 'bip39' },
    }

    it('splits a seed into k/ and m/ and removes the bare id', async () => {
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual(['root-1'])
        expect(storage.getString('root-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeDefined()
        expect(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(MATERIAL_PREFIX + 'root-1') as string,
            ),
        ).toBeDefined()
    })

    it('never writes material into the plaintext bucket', async () => {
        await seed(root)

        await adoptStrandedRecords(deps())

        expect(storage.getString(METADATA_PREFIX + 'root-1')).not.toContain(
            'privateKey',
        )
    })

    it('drops the stale bare copy when an identical pair already exists', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.adopted).toEqual([])
        expect(storage.getString('root-1')).toBeUndefined()
    })

    it('quarantines under -legacy when a different key already holds the id', async () => {
        await seed({ ...root, privateKey: new Uint8Array(96).fill(1) })
        await adoptStrandedRecords(deps())
        await seed({ ...root, privateKey: new Uint8Array(96).fill(2) })

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([
            { id: 'root-1', legacyId: 'root-1-legacy' },
        ])
        expect(
            storage.getString(METADATA_PREFIX + 'root-1-legacy'),
        ).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'root-1')).toBeDefined()
    })

    it('reports work only while bare candidates remain', async () => {
        await seed(root)
        expect(hasStrandedWork(storage)).toBe(true)

        await adoptStrandedRecords(deps())
        expect(hasStrandedWork(storage)).toBe(false)
    })

    it('stops reporting work for ids a pass decided belong at the bare id', async () => {
        await seed({
            id: 'cred-2',
            type: 'hd-derived-p256',
            algorithm: 'P256',
            privateKeyEnc: { iv: 'aa', data: 'bb' },
        })

        const result = await adoptStrandedRecords(deps())

        expect(hasStrandedWork(storage)).toBe(true)
        expect(hasStrandedWork(storage, new Set(result.leftFlat))).toBe(false)
    })

    it('completes a half-written pair rather than quarantining it', async () => {
        await seed(root)
        await adoptStrandedRecords(deps())
        storage.remove(METADATA_PREFIX + 'root-1')
        await seed(root)

        const result = await adoptStrandedRecords(deps())

        expect(result.quarantined).toEqual([])
        expect(storage.getString(METADATA_PREFIX + 'root-1')).toBeDefined()
        expect(storage.getString('root-1')).toBeUndefined()
    })
})
