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

    it('does not rewrite an already-present flat record', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        storage.set('cred-1', 'PRE-EXISTING-FLAT-RECORD')

        await migration.up(context(storage), utils())

        expect(storage.getString('cred-1')).toBe('PRE-EXISTING-FLAT-RECORD')
        expect(masterKeyForRead).not.toHaveBeenCalled()
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

    it('rethrows a master-key read failure that is not MasterKeyNotFoundError', async () => {
        const storage = fakeStorage({})
        await seededCredential(storage, {
            id: 'cred-1',
            publicKey: new Uint8Array(91).fill(4),
            privateKey: new Uint8Array(32).fill(3),
        })
        masterKeyForRead = vi.fn(async () => {
            throw new Error('unlock cancelled')
        })

        await expect(migration.up(context(storage), utils())).rejects.toThrow(
            'unlock cancelled',
        )
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
