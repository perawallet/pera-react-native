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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { base64 } from '@scure/base'
import {
    createSecretScratch,
    validateMigrations,
    type MigrationUtils,
} from '@algorandfoundation/provider-migrations'
import { assertIdempotent } from '@algorandfoundation/provider-migrations/testing'

// See 0002-lift-nested-material.spec.ts (preflight) for why the package root
// is mocked and why the prefixes/`serializeKey`/`MasterKeyNotFoundError`
// still come from its real dist while `sealData`/`openData`/`decode` cannot.
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
        openData: vi.fn(formats.openData),
        decode: formats.decode,
    }
})

import {
    MasterKeyNotFoundError,
    MATERIAL_PREFIX,
    METADATA_PREFIX,
    openData,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { PeraMigrationContext } from '../../types'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../__fixtures__/fakeStorage'
import {
    decode,
    openData as realOpenData,
    sealData,
} from '../../__fixtures__/keystoreFormats'
import { createDeclinedRegister } from '../../declined'
import { passkeyMainKeyId } from '../../../passkeyMainKey'
import { migration } from '../0003-mint-passkey-main-key'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

/** 16 bytes of 0x0a — the entropy every fixture wallet is built from. */
const ENTROPY = new Uint8Array(16).fill(10)

/**
 * PBKDF2-HMAC-SHA512(ENTROPY, salt `"liquid"`, 210,000 iterations, 64 bytes) —
 * the same contract `generateDP256Main` derives under. Pinned as a literal
 * rather than recomputed so a drift in salt, iteration count, digest or length
 * fails here instead of agreeing with itself.
 */
const MAIN_KEY_VECTOR =
    '9ca81987e424d8ca5bf7b572069af03d9f01b20f9e1d00d26f2008d518d8e5c5' +
    'b7df9a4c06c9fc7fbd858b8d40d4c728a57db216f250f4084d062de3298a3018'

const toHex = (bytes: Uint8Array): string =>
    Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

let logWarn: ReturnType<typeof vi.fn>

const utils = (): MigrationUtils => ({
    revision: {
        module: REPAIRS_MODULE_ID,
        id: migration.id,
        name: migration.name,
    },
    secrets: createSecretScratch().scratch,
    log: { info: vi.fn(), warn: logWarn, error: vi.fn() },
})

let noteStore: Record<string, string>

const noteStoreApi = () => ({
    getString: (key: string) => noteStore[key],
    set: (key: string, value: string) => {
        noteStore[key] = value
    },
})

let masterKeyForRead: ReturnType<typeof vi.fn>

const context = (storage: FakeKeychainStorage): PeraMigrationContext => ({
    storage,
    subtle,
    masterKeyForRead: masterKeyForRead as () => Promise<Uint8Array>,
    declined: createDeclinedRegister(noteStoreApi()),
})

/** The XHD wallet root as `useHDWallet` persists it. */
const seedRoot = (storage: FakeKeychainStorage, id: string): void => {
    storage.set(
        METADATA_PREFIX + id,
        serializeKey({
            id,
            type: 'hd-root-key',
            algorithm: 'raw',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            metadata: { storage: 'bytes', scheme: 'bip39' },
            version: 1,
        }),
    )
    storage.set(MATERIAL_PREFIX + id, 'sealed-root-material')
}

/** The `secret-key` child `commitSecret` writes for a seed's BIP39 entropy. */
const entropyChild = async (
    storage: FakeKeychainStorage,
    params: { id: string; parentKeyId: string; entropy?: Uint8Array },
): Promise<void> => {
    storage.set(
        METADATA_PREFIX + params.id,
        serializeKey({
            id: params.id,
            type: 'secret-key',
            algorithm: 'raw',
            extractable: false,
            keyUsages: [],
            metadata: {
                storage: 'bytes',
                parentKeyId: params.parentKeyId,
                entropyKey: true,
            },
            version: 1,
        }),
    )
    storage.set(
        MATERIAL_PREFIX + params.id,
        await sealData(
            subtle,
            MASTER_KEY,
            base64.encode(params.entropy ?? ENTROPY),
        ),
    )
}

/** A wallet that already carries its dp256 main key. */
const existingMainKey = (
    storage: FakeKeychainStorage,
    params: { id: string; parentKeyId: string },
): void => {
    storage.set(
        METADATA_PREFIX + params.id,
        serializeKey({
            id: params.id,
            type: 'hd-root-key',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['deriveBits', 'deriveKey'],
            metadata: {
                storage: 'bytes',
                scheme: 'pbkdf2-p256',
                parentKeyId: params.parentKeyId,
                id: params.id,
            },
            version: 1,
        }),
    )
    storage.set(MATERIAL_PREFIX + params.id, 'sealed-main-key-material')
}

const bip39Wallet = async (
    storage: FakeKeychainStorage,
    rootId = 'hd-1',
    childId = 'ent-1',
): Promise<void> => {
    seedRoot(storage, rootId)
    await entropyChild(storage, { id: childId, parentKeyId: rootId })
}

const declinedIds = (): string[] =>
    createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID)

describe('0003-mint-passkey-main-key', () => {
    beforeEach(() => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY.slice())
        noteStore = {}
        logWarn = vi.fn()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.mocked(openData).mockReset()
        vi.mocked(openData).mockImplementation(realOpenData)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('mints a pbkdf2-p256 root from the entropy child', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)

        await migration.up(context(storage), utils())

        const mainKeyId = passkeyMainKeyId('hd-1')
        expect(decode(storage.getString(METADATA_PREFIX + mainKeyId)!)).toEqual(
            {
                id: mainKeyId,
                type: 'hd-root-key',
                // Both halves of `deriveDomainKey`'s parent guard (create.js:774).
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['deriveBits', 'deriveKey'],
                metadata: {
                    storage: 'bytes',
                    scheme: 'pbkdf2-p256',
                    // The entropy child, not the XHD root.
                    parentKeyId: 'ent-1',
                    id: mainKeyId,
                },
                version: 1,
            },
        )
    })

    it('seals main-key material that opens to the PBKDF2 reference vector', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)

        await migration.up(context(storage), utils())

        const sealed = storage.getString(
            MATERIAL_PREFIX + passkeyMainKeyId('hd-1'),
        )!
        const bytes = base64.decode(
            await realOpenData(subtle, MASTER_KEY, sealed),
        )
        expect(bytes).toHaveLength(64)
        expect(toHex(bytes)).toBe(MAIN_KEY_VECTOR)
    })

    it('leaves a wallet that already has a main key untouched, without reading the master key', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        existingMainKey(storage, { id: 'main-existing', parentKeyId: 'ent-1' })
        const before = storage.entries()

        await migration.up(context(storage), utils())

        expect(storage.entries()).toEqual(before)
        // A second main key would change which secret new credentials derive
        // from; reading the master key here would also be an unexplained
        // biometric prompt at launch.
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('mints exactly one main key when the device has two bip39 wallets', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage, 'hd-b', 'ent-b')
        await bip39Wallet(storage, 'hd-a', 'ent-a')

        await migration.up(context(storage), utils())

        const minted = storage
            .getAllKeys()
            .filter(key => key.startsWith(METADATA_PREFIX))
            .filter(key => {
                const record = decode(storage.getString(key)!) as {
                    metadata?: { scheme?: string }
                }
                return record.metadata?.scheme === 'pbkdf2-p256'
            })
        // Sorted, so the winner does not depend on `getAllKeys()` order.
        expect(minted).toEqual([METADATA_PREFIX + passkeyMainKeyId('hd-a')])
    })

    it('mints past a k/ entry whose read throws', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        storage.set(METADATA_PREFIX + 'unreadable', '{}')
        const realGet = storage.getString.bind(storage)
        storage.getString = (key: string) => {
            if (key === METADATA_PREFIX + 'unreadable') {
                throw new Error('scan read boom')
            }
            return realGet(key)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        // Reached the mint: one bad neighbour in the scan must not cost the
        // wallet its main key, nor fail the module.
        expect(
            storage.getString(METADATA_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeDefined()
    })

    it('mints past a k/ entry this keystore did not write', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        storage.set(METADATA_PREFIX + 'foreign', 'not json at all')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(
            storage.getString(METADATA_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeDefined()
    })

    it('resolves and declines when a wallet root has no entropy child', async () => {
        const storage = fakeStorage({})
        seedRoot(storage, 'hd-1')
        const before = storage.entries()

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(storage.entries()).toEqual(before)
        expect(declinedIds()).toEqual(['hd-1'])
        // Decided from `k/` alone — no material read, so no biometric prompt.
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('resolves and declines when the entropy child cannot be opened', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        vi.mocked(openData).mockRejectedValueOnce(new Error('bad seal'))

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        // Nothing half-written: neither half of the main key survives.
        expect(
            storage.getString(METADATA_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('resolves and declines when the entropy child has no sealed material', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        storage.remove(MATERIAL_PREFIX + 'ent-1')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(
            storage.getString(METADATA_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('rolls the sealed material back when the metadata write fails', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        const mainKeyId = passkeyMainKeyId('hd-1')
        const realSet = storage.set.bind(storage)
        storage.set = (key: string, value: string) => {
            if (key === METADATA_PREFIX + mainKeyId) {
                throw new Error('metadata write boom')
            }
            realSet(key, value)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        // A `k/`-less `m/` is invisible, but a surviving one would be adopted
        // by a later run as an authoritative half-written root.
        expect(storage.getString(MATERIAL_PREFIX + mainKeyId)).toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('writes no metadata when the material seal fails', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        const mainKeyId = passkeyMainKeyId('hd-1')
        const realSet = storage.set.bind(storage)
        storage.set = (key: string, value: string) => {
            if (key === MATERIAL_PREFIX + mainKeyId) {
                throw new Error('material write boom')
            }
            realSet(key, value)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        // Material first, metadata second: a `k/` root whose `m/` cannot be
        // opened is one `selectParentKey` commits to and then fails on, which
        // is worse than no root at all.
        expect(storage.getString(METADATA_PREFIX + mainKeyId)).toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('resolves when the rollback itself fails', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        const mainKeyId = passkeyMainKeyId('hd-1')
        const realSet = storage.set.bind(storage)
        storage.set = (key: string, value: string) => {
            if (key === METADATA_PREFIX + mainKeyId) {
                throw new Error('metadata write boom')
            }
            realSet(key, value)
        }
        storage.remove = () => {
            throw new Error('remove boom')
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('resolves when the initial key scan throws', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        storage.getAllKeys = () => {
            throw new Error('mmkv boom')
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('resolves when reading the entropy child material throws', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        const realGet = storage.getString.bind(storage)
        storage.getString = (key: string) => {
            if (key === MATERIAL_PREFIX + 'ent-1') throw new Error('read boom')
            return realGet(key)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('resolves and declines on a fresh install with no master key', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)
        masterKeyForRead = vi.fn(async () => {
            throw new MasterKeyNotFoundError()
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(
            storage.getString(METADATA_PREFIX + passkeyMainKeyId('hd-1')),
        ).toBeUndefined()
        expect(declinedIds()).toEqual(['hd-1'])
    })

    it('is idempotent', async () => {
        const storage = fakeStorage({})
        await bip39Wallet(storage)

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

    // `validateMigrations` above only rejects a descending id; this pins the
    // concrete registration, which is what decides run order.
    it('is registered after the credential rematerialization revision', () => {
        expect(repairsMigrations.map(revision => revision.name)).toEqual([
            'normalize-canary13-records',
            'rematerialize-passkey-credentials',
            'mint-passkey-main-key',
        ])
    })
})
