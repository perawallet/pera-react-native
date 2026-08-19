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
import { base64, base64url } from '@scure/base'
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
        // Wrapped in vi.fn so individual tests can queue a one-off failure
        // (the delete-after-verify path) while every other call keeps
        // exercising the real fixture implementation.
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
import { sealNativeCredentialRecord } from '../../nativeCredentialRecord'
import { migration } from '../0002-rematerialize-passkey-credentials'
import { REPAIRS_MODULE_ID, repairsMigrations } from '../index'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle

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

/** Seeds an already-adopted `k/`+`m/` passkey credential pair. */
const seededCredential = async (
    storage: FakeKeychainStorage,
    params: {
        id: string
        type?: string
        publicKey: Uint8Array
        privateKey: Uint8Array
        userHandle?: string
    },
): Promise<void> => {
    storage.set(
        METADATA_PREFIX + params.id,
        serializeKey({
            id: params.id,
            type: params.type ?? 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            name: `Passkey: https://webauthn.io`,
            publicKey: params.publicKey,
            metadata: {
                origin: 'https://webauthn.io',
                userHandle: params.userHandle ?? 'user-1',
                userId: 'user-1',
                count: 0,
            },
        } as unknown as Parameters<typeof serializeKey>[0]),
    )
    storage.set(
        MATERIAL_PREFIX + params.id,
        await sealData(subtle, MASTER_KEY, base64.encode(params.privateKey)),
    )
}

/**
 * The exact read algorithm `packages/passkeys/src/native/nativeProviderRecord.ts`'s
 * `openNativeProviderRecord` implements — restated because `extensions/provider`
 * cannot depend on `packages/passkeys` (the reverse dependency already exists;
 * see `nativeCredentialRecord.ts`'s module doc). Proves the flat record this
 * revision writes is readable by the provider's own three-field envelope +
 * base64url(JSON)-with-number-arrays contract, independently of the
 * production seal implementation under test.
 */
const openFlatProviderRecord = async (
    key: Uint8Array,
    payload: string,
): Promise<Record<string, unknown>> => {
    const envelope = JSON.parse(payload) as {
        iv: string
        tag: string
        content: string
    }
    const fromStandardBase64 = (value: string): Uint8Array =>
        Uint8Array.from(atob(value), char => char.charCodeAt(0))
    const content = fromStandardBase64(envelope.content)
    const tag = fromStandardBase64(envelope.tag)
    const sealed = new Uint8Array(content.length + tag.length)
    sealed.set(content)
    sealed.set(tag, content.length)

    const cryptoKey = await subtle.importKey(
        'raw',
        key as unknown as BufferSource,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
    )
    const plaintext = await subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: fromStandardBase64(envelope.iv) as unknown as BufferSource,
        },
        cryptoKey,
        sealed as unknown as BufferSource,
    )
    const base64url_ = new TextDecoder().decode(plaintext)
    return JSON.parse(
        new TextDecoder().decode(base64url.decode(base64url_)),
    ) as Record<string, unknown>
}

describe('0002-rematerialize-passkey-credentials', () => {
    beforeEach(() => {
        masterKeyForRead = vi.fn(async () => MASTER_KEY.slice())
        noteStore = {}
        logWarn = vi.fn()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        // Clears any once-queued failure a prior test left unconsumed and
        // restores the real fixture as the default implementation.
        vi.mocked(openData).mockReset()
        vi.mocked(openData).mockImplementation(realOpenData)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('rematerializes an adopted hd-derived-p256 credential, and it round-trips through the provider envelope', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            type: 'hd-derived-p256',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect(record.type).toBe('hd-derived-p256')
        expect(record.privateKey).toEqual(
            Array.from(new Uint8Array(32).fill(3)),
        )
        expect(record.publicKey).toEqual(Array.from(new Uint8Array(91).fill(4)))
        // Un-adopts, not dual-writes: Android's CredentialRepository.getCredential
        // tries the split layout first and returns early on it, so a surviving
        // k/+m/ pair shadows the flat copy just restored beside it.
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeUndefined()
    })

    it('rematerializes an adopted legacy xhd-derived-p256 credential', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-legacy',
            type: 'xhd-derived-p256',
            publicKey: new Uint8Array(91).fill(6),
            privateKey: new Uint8Array(32).fill(5),
        })

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-legacy')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect(record.type).toBe('xhd-derived-p256')
        expect(record.privateKey).toEqual(
            Array.from(new Uint8Array(32).fill(5)),
        )
        expect(
            storage.getString(METADATA_PREFIX + 'cred-legacy'),
        ).toBeUndefined()
        expect(
            storage.getString(MATERIAL_PREFIX + 'cred-legacy'),
        ).toBeUndefined()
    })

    it('carries an arbitrary top-level field (standing in for privateKeyEnc) across verbatim', async () => {
        const storage = fakeStorage({})
        const privateKeyEnc = { iv: [1, 2, 3], data: [4, 5, 6] }
        storage.set(
            METADATA_PREFIX + 'cred-1',
            serializeKey({
                id: 'cred-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                publicKey: new Uint8Array(91).fill(4),
                privateKeyEnc,
                metadata: { origin: 'https://webauthn.io', userHandle: 'u' },
            } as unknown as Parameters<typeof serializeKey>[0]),
        )
        storage.set(
            MATERIAL_PREFIX + 'cred-1',
            await sealData(
                subtle,
                MASTER_KEY,
                base64.encode(new Uint8Array(32).fill(3)),
            ),
        )

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        // A `pick`-style rewrite of the `...rest` spread would drop this
        // silently and destroy a biometric-gated credential while appearing
        // to succeed.
        expect(record.privateKeyEnc).toEqual(privateKeyEnc)
    })

    it('leaves the split k/+m/ pair intact and declines the credential when the rematerialized record fails to verify', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        // First call decrypts the m/ material as usual; the second is the
        // post-write readback, which is where a corrupted write must be caught.
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) throw new Error('readback failed')
            return realOpenData(...args)
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
    })

    // A `console.warn` that itself throws (RN's LogBox patch) is exactly the
    // hazard `safeWarn` exists to swallow. This module's own warn calls sit in
    // a `catch` inside `up` with no outer `try`, so an unguarded one would
    // escape `up` verbatim.
    it('does not reject up when console.warn itself throws during the un-rematerialize log', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) throw new Error('readback failed')
            return realOpenData(...args)
        })
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
    })

    // The stringify half of the same line: `safeErrorMessage(error)` is an
    // argument, so it is evaluated before `safeWarn`'s `try` is entered, and
    // the caught value is whatever the envelope threw — not necessarily an
    // `Error`.
    it('does not reject up when the un-rematerialize failure cannot be stringified', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                throw {
                    toString: () => {
                        throw new Error('cannot stringify')
                    },
                }
            }
            return realOpenData(...args)
        })
        const consoleWarn = vi.spyOn(console, 'warn')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('left un-rematerialized:'),
        )
    })

    it('never mentions key material when a rematerialization failure is logged', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) throw new Error('readback failed')
            return realOpenData(...args)
        })
        const consoleWarn = vi.spyOn(console, 'warn')

        await migration.up(context(storage), utils())

        expect(consoleWarn).toHaveBeenCalled()
        for (const call of consoleWarn.mock.calls) {
            expect(JSON.stringify(call)).not.toContain('3,3,3')
        }
    })

    it('leaves a non-credential k/ record untouched', async () => {
        const storage = fakeStorage({
            [METADATA_PREFIX + 'seed-1']: serializeKey({
                id: 'seed-1',
                type: 'hd-root-key',
                algorithm: 'raw',
                extractable: false,
            } as unknown as Parameters<typeof serializeKey>[0]),
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('seed-1')).toBeUndefined()
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('still un-adopts when a flat copy already exists, as after a launch killed between the write and the k/+m/ removals', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        // "Done" is the absence of k/, not the presence of a flat copy — a
        // stale or even correct flat record must not stop k/+m/ from being
        // read, verified, and removed.
        storage.set('cred-1', 'STALE-FLAT-RECORD-FROM-AN-INTERRUPTED-RUN')

        await migration.up(context(storage), utils())

        expect(masterKeyForRead).toHaveBeenCalled()
        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        expect(flat).not.toBe('STALE-FLAT-RECORD-FROM-AN-INTERRUPTED-RUN')
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect(record.type).toBe('hd-derived-p256')
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeUndefined()
    })

    it('removes k/ before m/: a failure removing the split pair leaves only a harmless orphaned m/, keeps the flat record, and declines', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            // Simulates the metadata removal landing and the material
            // removal failing right after — the probe that catches a
            // rollback broad enough to also undo an already-verified write.
            if (key === MATERIAL_PREFIX + 'cred-1') {
                throw new Error('storage failure removing m/')
            }
            originalRemove(key)
        }
        const consoleWarn = vi.spyOn(console, 'warn')

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect(record.type).toBe('hd-derived-p256')
        expect(record.privateKey).toEqual(
            Array.from(new Uint8Array(32).fill(3)),
        )
        // k/ removed (order pinned: metadata first), m/ orphaned, not the
        // reverse — a surviving k/ with no material would still trigger
        // Android's split-first lookup and could only ever be declined by a
        // resume gate keyed on k/'s presence.
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeUndefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
        expect(consoleWarn).toHaveBeenCalled()
    })

    // Same fixture, but the orphaned-pair warn itself throws. That warn sits in
    // a `catch` with no enclosing `try` between it and `up`'s body, so an
    // unguarded `console.warn` escapes `up` verbatim and bricks boot.
    it('does not reject up when console.warn itself throws during the orphaned-pair log', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            if (key === MATERIAL_PREFIX + 'cred-1') {
                throw new Error('storage failure removing m/')
            }
            originalRemove(key)
        }
        vi.spyOn(console, 'warn').mockImplementation(() => {
            throw new Error('LogBox is not ready')
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
    })

    // The stringify half of the same line: `safeErrorMessage(error)` is an
    // argument, so it is evaluated before `safeWarn`'s `try` is entered.
    it('does not reject up when the orphaned-pair failure cannot be stringified', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            if (key === MATERIAL_PREFIX + 'cred-1') {
                throw {
                    toString: () => {
                        throw new Error('cannot stringify')
                    },
                }
            }
            originalRemove(key)
        }
        const consoleWarn = vi.spyOn(console, 'warn')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('orphaned k/+m/ pair:'),
        )
    })

    it('restores the previously-verified flat record rather than deleting it when a re-run cannot reach the material', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        // Simulates run 1: wrote and verified a flat copy, then was killed
        // before removing k/+m/ — exactly the state the resume gate exists
        // to reprocess.
        const goodFlat = await sealNativeCredentialRecord(subtle, MASTER_KEY, {
            id: 'cred-1',
            type: 'hd-derived-p256',
            privateKey: Array.from(new Uint8Array(32).fill(3)),
            publicKey: Array.from(new Uint8Array(91).fill(4)),
        })
        storage.set('cred-1', goodFlat)
        // Run 2: the m/ material is unreadable (corrupt seal / GCM tag
        // mismatch) — a real failure, not a mock artifact of the test setup.
        vi.mocked(openData).mockImplementation(async () => {
            throw new Error('GCM tag mismatch')
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBe(goodFlat)
    })

    it('restores the previously-verified flat record rather than deleting it when the rewrite itself fails', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const goodFlat = await sealNativeCredentialRecord(subtle, MASTER_KEY, {
            id: 'cred-1',
            type: 'hd-derived-p256',
            privateKey: Array.from(new Uint8Array(32).fill(3)),
            publicKey: Array.from(new Uint8Array(91).fill(4)),
        })
        storage.set('cred-1', goodFlat)
        const originalSet = storage.set.bind(storage)
        let flatWriteAttempts = 0
        storage.set = (key: string, value: string) => {
            if (key === 'cred-1') {
                flatWriteAttempts += 1
                // Only the rewrite attempt fails; a later restore of the
                // prior good value must still be able to land.
                if (flatWriteAttempts === 1) {
                    throw new Error('storage failure writing flat record')
                }
            }
            originalSet(key, value)
        }

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBe(goodFlat)
    })

    it('does not reject up (probe A) when the restore attempt itself also fails to land', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const goodFlat = await sealNativeCredentialRecord(subtle, MASTER_KEY, {
            id: 'cred-1',
            type: 'hd-derived-p256',
            privateKey: Array.from(new Uint8Array(32).fill(3)),
            publicKey: Array.from(new Uint8Array(91).fill(4)),
        })
        storage.set('cred-1', goodFlat)
        // Unlike the test above, EVERY write to 'cred-1' fails — the rewrite
        // attempt and the restore both. The rollback must not let that
        // escape `up`: a rejecting `up` rejects `keystore.ready`, and since
        // the ledger only writes once `up` resolves, this module would
        // re-run and re-fail on every subsequent launch.
        storage.set = (key: string) => {
            if (key === 'cred-1') {
                throw new Error('storage failure writing flat record')
            }
        }
        const consoleWarn = vi.spyOn(console, 'warn')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        // The rewrite attempt never landed (it throws before touching the
        // map), so the pre-existing good copy is exactly where it was —
        // untouched, not merely "restored".
        expect(storage.getString('cred-1')).toBe(goodFlat)
        expect(consoleWarn).toHaveBeenCalled()
    })

    it('does not reject up (probe B) when there is no prior flat copy and the rollback remove itself fails', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        // Forces the readback verification to fail (a real, decodable
        // envelope sealed under the wrong private key) rather than an
        // upstream decrypt failure, so there IS a fresh (bad) write at
        // 'cred-1' for the rollback's `storage.remove(id)` branch to target.
        const wrongRecordSealed = await sealNativeCredentialRecord(
            subtle,
            MASTER_KEY,
            {
                id: 'cred-1',
                type: 'hd-derived-p256',
                privateKey: Array.from(new Uint8Array(32).fill(99)),
                publicKey: Array.from(new Uint8Array(91).fill(4)),
            },
        )
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                return realOpenData(subtle, MASTER_KEY, wrongRecordSealed)
            }
            return realOpenData(...args)
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            if (key === 'cred-1') {
                throw new Error('MMKV remove failure')
            }
            originalRemove(key)
        }
        const consoleWarn = vi.spyOn(console, 'warn')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(consoleWarn).toHaveBeenCalled()
    })

    // Probe B's fixture, plus a `console.warn` that throws for the
    // rollback-failure line only. Scoped that way on purpose: the same fixture
    // also reaches the un-rematerialize warn (already pinned), so throwing for
    // every message would pass whichever of the two lost its guard.
    it('does not reject up when console.warn itself throws during the rollback-failure log', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const wrongRecordSealed = await sealNativeCredentialRecord(
            subtle,
            MASTER_KEY,
            {
                id: 'cred-1',
                type: 'hd-derived-p256',
                privateKey: Array.from(new Uint8Array(32).fill(99)),
                publicKey: Array.from(new Uint8Array(91).fill(4)),
            },
        )
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                return realOpenData(subtle, MASTER_KEY, wrongRecordSealed)
            }
            return realOpenData(...args)
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            if (key === 'cred-1') {
                throw new Error('MMKV remove failure')
            }
            originalRemove(key)
        }
        let rollbackLogs = 0
        vi.spyOn(console, 'warn').mockImplementation(message => {
            if (String(message).includes('rollback itself failed')) {
                rollbackLogs += 1
                throw new Error('LogBox is not ready')
            }
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(rollbackLogs).toBe(1)
    })

    // Same fixture again, but the rollback throws a value that cannot be
    // stringified. `safeErrorMessage(rollbackError)` is an argument to
    // `safeWarn`, so it runs outside `safeWarn`'s `try`; the enclosing `catch`
    // is the one already handling `error`, so a throw here escapes `up`.
    it('does not reject up when the rollback failure cannot be stringified', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const wrongRecordSealed = await sealNativeCredentialRecord(
            subtle,
            MASTER_KEY,
            {
                id: 'cred-1',
                type: 'hd-derived-p256',
                privateKey: Array.from(new Uint8Array(32).fill(99)),
                publicKey: Array.from(new Uint8Array(91).fill(4)),
            },
        )
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                return realOpenData(subtle, MASTER_KEY, wrongRecordSealed)
            }
            return realOpenData(...args)
        })
        const originalRemove = storage.remove.bind(storage)
        storage.remove = (key: string) => {
            if (key === 'cred-1') {
                throw {
                    toString: () => {
                        throw new Error('cannot stringify')
                    },
                }
            }
            originalRemove(key)
        }
        const consoleWarn = vi.spyOn(console, 'warn')

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()

        expect(consoleWarn).toHaveBeenCalledWith(
            expect.stringContaining('rollback itself failed'),
        )
    })

    it('leaves the bare id untouched on a later failure when the prior-flat read itself throws', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        storage.set('cred-1', 'UNKNOWN-CONTENT-COULD-BE-GOOD-OR-BAD')
        const originalGetString = storage.getString.bind(storage)
        let priorFlatReadShouldThrow = true
        storage.getString = (key: string) => {
            if (key === 'cred-1' && priorFlatReadShouldThrow) {
                priorFlatReadShouldThrow = false
                throw new Error('MMKV read failure')
            }
            return originalGetString(key)
        }
        // Any later failure exercises the same catch; a decrypt failure on
        // the material is the simplest one to force.
        vi.mocked(openData).mockImplementation(async () => {
            throw new Error('bad tag')
        })

        await migration.up(context(storage), utils())

        // Unknown prior state must never be guessed at: not restored (we
        // don't have the value) and not removed (we don't know it was
        // absent) — left exactly as it was.
        expect(storage.getString('cred-1')).toBe(
            'UNKNOWN-CONTENT-COULD-BE-GOOD-OR-BAD',
        )
    })

    it('declines rather than un-adopting a credential whose metadata carries no usable publicKey', async () => {
        const storage = fakeStorage({})
        storage.set(
            METADATA_PREFIX + 'cred-1',
            serializeKey({
                id: 'cred-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                // No publicKey at all — the shape iOS's allKeystoreCredentials()
                // guard cannot pass either way.
                metadata: { origin: 'https://webauthn.io', userHandle: 'u' },
            } as unknown as Parameters<typeof serializeKey>[0]),
        )
        storage.set(
            MATERIAL_PREFIX + 'cred-1',
            await sealData(
                subtle,
                MASTER_KEY,
                base64.encode(new Uint8Array(32).fill(3)),
            ),
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
    })

    it('does not reject up when getAllKeys throws', async () => {
        const storage = fakeStorage({})
        storage.getAllKeys = () => {
            throw new Error('MMKV corrupted')
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('skips a record whose metadata read throws, without rejecting up', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const originalGetString = storage.getString.bind(storage)
        storage.getString = (key: string) => {
            if (key === METADATA_PREFIX + 'cred-1') {
                throw new Error('MMKV read failure')
            }
            return originalGetString(key)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('declines a credential whose material read throws, without rejecting up', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const originalGetString = storage.getString.bind(storage)
        storage.getString = (key: string) => {
            if (key === MATERIAL_PREFIX + 'cred-1') {
                throw new Error('MMKV read failure')
            }
            return originalGetString(key)
        }

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.getString('cred-1')).toBeUndefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
    })

    it('leaves the split pair intact when the readback decodes successfully but to the wrong private key', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        // A real, decodable envelope — just sealed under the WRONG private
        // key — so the verify step succeeds at *decoding* and must still
        // catch the byte mismatch. A predicate reduced to "did decode()
        // throw" (or a `bytesEqual` that always returns true) would pass this.
        const wrongRecordSealed = await sealNativeCredentialRecord(
            subtle,
            MASTER_KEY,
            {
                id: 'cred-1',
                type: 'hd-derived-p256',
                privateKey: Array.from(new Uint8Array(32).fill(99)),
                publicKey: Array.from(new Uint8Array(91).fill(4)),
            },
        )
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                return realOpenData(subtle, MASTER_KEY, wrongRecordSealed)
            }
            return realOpenData(...args)
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
    })

    it('leaves the split pair intact when the readback decodes successfully but to the wrong public key', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        const wrongRecordSealed = await sealNativeCredentialRecord(
            subtle,
            MASTER_KEY,
            {
                id: 'cred-1',
                type: 'hd-derived-p256',
                privateKey: Array.from(new Uint8Array(32).fill(3)),
                publicKey: Array.from(new Uint8Array(91).fill(200)),
            },
        )
        let openDataCalls = 0
        vi.mocked(openData).mockImplementation(async (...args) => {
            openDataCalls += 1
            if (openDataCalls === 2) {
                return realOpenData(subtle, MASTER_KEY, wrongRecordSealed)
            }
            return realOpenData(...args)
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
    })

    it('carries the metadata.migration flag upstream stamps on a legacy passkey across the un-adopt', async () => {
        const storage = fakeStorage({})
        storage.set(
            METADATA_PREFIX + 'cred-1',
            serializeKey({
                id: 'cred-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                publicKey: new Uint8Array(91).fill(4),
                metadata: {
                    origin: 'https://webauthn.io',
                    userHandle: 'u',
                    migration: 'needed',
                },
            } as unknown as Parameters<typeof serializeKey>[0]),
        )
        storage.set(
            MATERIAL_PREFIX + 'cred-1',
            await sealData(
                subtle,
                MASTER_KEY,
                base64.encode(new Uint8Array(32).fill(3)),
            ),
        )

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect((record.metadata as Record<string, unknown>).migration).toBe(
            'needed',
        )
    })

    it('carries a non-ASCII userHandle through the migration end-to-end', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
            userHandle: 'ünïcode',
        })

        await migration.up(context(storage), utils())

        const flat = storage.getString('cred-1')
        expect(flat).toBeDefined()
        const record = await openFlatProviderRecord(MASTER_KEY, flat!)
        expect((record.metadata as Record<string, unknown>).userHandle).toBe(
            'ünïcode',
        )
    })

    it('is a no-op when no credential records exist', async () => {
        const storage = fakeStorage({})

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.entries()).toEqual({})
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('is a no-op on empty storage', async () => {
        const storage = fakeStorage({})

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('leaves a credential un-rematerialized and declined when its material is missing', async () => {
        const storage = fakeStorage({
            [METADATA_PREFIX + 'cred-1']: serializeKey({
                id: 'cred-1',
                type: 'hd-derived-p256',
                algorithm: 'P256',
                extractable: false,
                keyUsages: ['sign'],
                publicKey: new Uint8Array(91).fill(4),
                metadata: { origin: 'https://webauthn.io', userHandle: 'u' },
            } as unknown as Parameters<typeof serializeKey>[0]),
        })

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeUndefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
        expect(logWarn).toHaveBeenCalledWith(
            expect.stringContaining(
                '1 passkey credential(s) un-rematerialized',
            ),
            { entries: ['cred-1'] },
            REPAIRS_MODULE_ID,
        )
    })

    it('is declined, not thrown, when the master key is missing', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        masterKeyForRead = vi.fn(async () => {
            throw new MasterKeyNotFoundError()
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(storage.getString('cred-1')).toBeUndefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
    })

    // PROBE G: `context.declined.record(...)` sits outside every `try` in this
    // module. A declined credential is precisely the case where `record`'s
    // ledger write fires (it early-returns on an empty id list), so a write
    // failure coinciding with a decline must not escape `up` either.
    it('does not reject up (PROBE G) when a credential is declined and the declined-ledger write itself fails', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        vi.mocked(openData).mockImplementation(async () => {
            throw new Error('bad tag')
        })
        let setAttempts = 0
        const noteBacking: Record<string, string> = {}
        const throwingNoteStore = {
            getString: (key: string) => noteBacking[key],
            set: () => {
                setAttempts += 1
                throw new Error('MMKV ledger write failure')
            },
        }

        await expect(
            migration.up(
                {
                    ...context(storage),
                    declined: createDeclinedRegister(throwingNoteStore),
                },
                utils(),
            ),
        ).resolves.toBeUndefined()

        // The guarded write was actually attempted (not a no-op that would
        // also pass `resolves.toBeUndefined()`), and the credential is left
        // exactly where the un-adopt's own decline path leaves it — split
        // pair intact, no flat copy — regardless of the ledger write failing.
        expect(setAttempts).toBe(1)
        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
    })

    // PROBE H: the `MasterKeyNotFoundError` branch calls `context.declined.record`
    // directly with the full pending list, so this is a second, independent
    // path into the same unguarded write.
    it('does not reject up (PROBE H) when the master key is missing and the declined-ledger write itself fails', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        masterKeyForRead = vi.fn(async () => {
            throw new MasterKeyNotFoundError()
        })
        let setAttempts = 0
        const noteBacking: Record<string, string> = {}
        const throwingNoteStore = {
            getString: (key: string) => noteBacking[key],
            set: () => {
                setAttempts += 1
                throw new Error('MMKV ledger write failure')
            },
        }

        await expect(
            migration.up(
                {
                    ...context(storage),
                    declined: createDeclinedRegister(throwingNoteStore),
                },
                utils(),
            ),
        ).resolves.toBeUndefined()

        expect(setAttempts).toBe(1)
        expect(storage.getString('cred-1')).toBeUndefined()
        expect(storage.getString(METADATA_PREFIX + 'cred-1')).toBeDefined()
        expect(storage.getString(MATERIAL_PREFIX + 'cred-1')).toBeDefined()
    })

    // The one path where the fix changes behaviour rather than just
    // swallowing a failure: an unreadable declined-ledger must not overwrite
    // whatever a prior run already recorded there.
    it('does not reject up and leaves a pre-existing declined note untouched when the ledger read fails', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        vi.mocked(openData).mockImplementation(async () => {
            throw new Error('bad tag')
        })
        const priorNote = JSON.stringify(['cred-earlier'])
        const noteKey = `com.perawallet.wallet/declined-records/${REPAIRS_MODULE_ID}`
        const noteBacking: Record<string, string> = { [noteKey]: priorNote }
        let getAttempts = 0
        const readThrowingNoteStore = {
            getString: () => {
                getAttempts += 1
                throw new Error('MMKV ledger read failure')
            },
            set: (key: string, value: string) => {
                noteBacking[key] = value
            },
        }

        await expect(
            migration.up(
                {
                    ...context(storage),
                    declined: createDeclinedRegister(readThrowingNoteStore),
                },
                utils(),
            ),
        ).resolves.toBeUndefined()

        // The guarded read was actually attempted (not a `record` that never
        // ran at all, which would also leave the note untouched).
        expect(getAttempts).toBe(1)
        expect(noteBacking[noteKey]).toBe(priorNote)
    })

    // A cancelled or locked Keychain arrives as a plain `Error`, not
    // `MasterKeyNotFoundError`. It is "cannot reach the material" all the
    // same, and rejecting `up` would re-fail every launch.
    it('resolves and declines when the master-key read fails for any other reason', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        masterKeyForRead = vi.fn(async () => {
            throw new Error('unlock cancelled')
        })

        await expect(
            migration.up(context(storage), utils()),
        ).resolves.toBeUndefined()
        expect(
            createDeclinedRegister(noteStoreApi()).read(REPAIRS_MODULE_ID),
        ).toEqual(['cred-1'])
    })

    it('does not disturb an unrelated record beside a rematerialized credential', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        storage.set(
            METADATA_PREFIX + 'other-key',
            serializeKey({
                id: 'other-key',
                type: 'ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                publicKey: new Uint8Array(32).fill(9),
            } as unknown as Parameters<typeof serializeKey>[0]),
        )

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBeDefined()
        expect(storage.getString('other-key')).toBeUndefined()
        expect(
            decode(storage.getString(METADATA_PREFIX + 'other-key')!),
        ).toMatchObject({ id: 'other-key' })
    })

    it('is idempotent', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
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
