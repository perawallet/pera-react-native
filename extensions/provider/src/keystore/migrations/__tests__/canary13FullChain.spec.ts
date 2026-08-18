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
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'

// This spec lives one level shallower than the preflight/repairs specs
// (`migrations/__tests__/` vs `migrations/preflight/__tests__/`), so the walk
// to `node_modules` is four `../` segments, not five. See
// `preflight/__tests__/0004-adopt-material-less-records.spec.ts` for why the
// package root is mocked at all and why the prefixes/`serializeKey`/
// `MasterKeyNotFoundError` still come from its real dist while
// `sealData`/`openData`/`decode` cannot.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats = await import('../__fixtures__/keystoreFormats')

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
import type { PeraMigrationContext } from '../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../__fixtures__/fakeStorage'
import {
    canary13DerivedChild,
    sealCanary13Record,
} from '../__fixtures__/keystoreFormats'
import { createDeclinedRegister } from '../declined'
import { preflightMigrations } from '../preflight'
import { repairsMigrations } from '../repairs'

const MASTER_KEY = new Uint8Array(32).fill(7)
const ROOT_MATERIAL = new Uint8Array(96).fill(9)
const subtle = globalThis.crypto.subtle

/** Stands in for the migrations ledger's MMKV instance. */
let noteStore: Record<string, string>

const noteStoreApi = () => ({
    getString: (key: string) => noteStore[key],
    set: (key: string, value: string) => {
        noteStore[key] = value
    },
})

let masterKeyForRead: () => Promise<Uint8Array>

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead,
    declined: createDeclinedRegister(noteStoreApi()),
})

const utils = (revision: {
    module: string
    id: number
    name: string
}): MigrationUtils => ({
    revision,
    secrets: createSecretScratch().scratch,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
})

// Every record shape a real pre-upgrade (canary.13) device could hold: a
// top-level-material root, top-level-material entropy, an HD-derived child
// with no material of its own, an algo25 seed + its child, the PIN secret,
// and both a plain and a biometric-wrapped passkey credential.
const RECORDS: object[] = [
    {
        id: 'root-1',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: ROOT_MATERIAL,
        metadata: { scheme: 'bip39', name: 'Imported Seed' },
    },
    {
        id: 'entropy-1',
        type: 'secret-key',
        name: 'Secret',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: [],
        privateKey: new Uint8Array(32).fill(4),
        metadata: { parentKeyId: 'root-1', entropyKey: true },
    },
    canary13DerivedChild({
        id: 'child-1',
        parentKeyId: 'root-1',
        rootPrivateKey: ROOT_MATERIAL,
    }),
    {
        id: 'algo25-seed',
        type: 'seed',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: new Uint8Array(32).fill(5),
        metadata: { scheme: 'algo25' },
    },
    {
        id: 'algo25-child',
        type: 'ed25519',
        name: 'Ed25519 Key',
        algorithm: 'EdDSA',
        format: 'raw',
        extractable: true,
        keyUsages: ['sign', 'verify'],
        publicKey: new Uint8Array(32).fill(6),
        privateKey: new Uint8Array(64).fill(7),
        metadata: { parentKeyId: 'algo25-seed' },
    },
    {
        id: 'pera.pinCode',
        type: 'secret-key',
        name: 'Secret',
        algorithm: 'raw',
        format: 'raw',
        extractable: true,
        keyUsages: [],
        privateKey: new Uint8Array(16).fill(8),
        metadata: {},
    },
    {
        id: 'cred-plain',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['sign'],
        publicKey: new Uint8Array(32).fill(2),
        privateKey: new Uint8Array(32).fill(3),
        metadata: { origin: 'https://example.com' },
    },
    {
        id: 'cred-wrapped',
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['sign'],
        publicKey: new Uint8Array(32).fill(2),
        privateKeyEnc: { iv: 'aa', data: 'bb' },
        metadata: { origin: 'https://example.com' },
    },
]

describe('canary.13 full chain (preflight + repairs)', () => {
    let storage: FakeKeychainStorage

    beforeEach(async () => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY.slice())
        noteStore = {}
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        storage = fakeStorage({})
        for (const record of RECORDS) {
            storage.set(
                (record as { id: string }).id,
                await sealCanary13Record(subtle, MASTER_KEY, record),
            )
        }
    })

    const runChain = async () => {
        for (const migration of preflightMigrations) {
            await migration.up(
                context(storage),
                utils({
                    module: 'com.perawallet.wallet/keystore-preflight',
                    id: migration.id,
                    name: migration.name,
                }),
            )
        }
        for (const migration of repairsMigrations) {
            await migration.up(
                context(storage),
                utils({
                    module: 'com.perawallet.wallet/keystore-repairs',
                    id: migration.id,
                    name: migration.name,
                }),
            )
        }
    }

    it('strands nothing after the whole chain runs', async () => {
        await runChain()

        for (const id of [
            'root-1',
            'entropy-1',
            'algo25-seed',
            'algo25-child',
            'pera.pinCode',
        ]) {
            expect(storage.getString(METADATA_PREFIX + id)).toBeDefined()
            expect(storage.getString(MATERIAL_PREFIX + id)).toBeDefined()
            expect(storage.getString(id)).toBeUndefined()
        }

        // Derived children carry no material of their own in the new layout.
        expect(storage.getString(METADATA_PREFIX + 'child-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'child-1')).toBeUndefined()

        // Both native credential providers read passkeys at the bare id.
        expect(storage.getString('cred-plain')).toBeDefined()
        expect(
            storage.getString(METADATA_PREFIX + 'cred-plain'),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + 'cred-plain'),
        ).toBeUndefined()
        expect(storage.getString('cred-wrapped')).toBeDefined()
        expect(
            storage.getString(METADATA_PREFIX + 'cred-wrapped'),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + 'cred-wrapped'),
        ).toBeUndefined()
    })

    it('is a no-op on a second run', async () => {
        await runChain()
        const after = storage.entries()

        await runChain()

        expect(storage.entries()).toEqual(after)
    })
})
