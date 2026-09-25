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
import { base64, base64url } from '@scure/base'

vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')
    const errors =
        await import('../../../../node_modules/@algorandfoundation/react-native-keystore/dist/errors.js')
    const formats =
        await import('../../migrations/__fixtures__/keystoreFormats')
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
    MasterKeyNotFoundError,
    serializeKey,
} from '@algorandfoundation/react-native-keystore'
import type { Key } from '@algorandfoundation/keystore-core'
import {
    fakeStorage,
    type FakeKeychainStorage,
} from '../../migrations/__fixtures__/fakeStorage'
import {
    decodedRecords,
    openData,
    resetDecoded,
    sealCanary13Record,
    sealData,
} from '../../migrations/__fixtures__/keystoreFormats'
import { sealNativeCredentialRecord } from '../../migrations/nativeCredentialRecord'
import { splitProviderCredential } from '../splitProviderCredential'
import { writeSplitProviderCredential } from '../splitCredentialStorage'
import { splitFlatPasskeyCredentials } from '../splitFlatPasskeyCredentials'

const MASTER_KEY = new Uint8Array(32).fill(7)
const subtle = globalThis.crypto.subtle
const PUBLIC_KEY = new Uint8Array(4).fill(4)
const PRIVATE_KEY = new Uint8Array(32).fill(3)
const CIPHERTEXT = new Uint8Array(48).fill(9)
const IV = 'AAAAAAAAAAAAAAAA'
/** A real provider id: standard base64 of 32 bytes, so it carries `+`, `/` and `=`. */
const CRED_ID = base64.encode(
    Uint8Array.from({ length: 32 }, (_, i) => [0xfb, 0xff, 0xbf][i % 3]),
)
/** Another id shaped like the provider's: standard base64 of 32 bytes. */
const credentialId = (fill: number): string =>
    base64.encode(new Uint8Array(32).fill(fill))
const EMPTY = { split: [], normalized: [], failed: [] }

const credentialJson = (overrides: Record<string, unknown> = {}) => ({
    id: CRED_ID,
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: https://webauthn.io',
    publicKey: Array.from(PUBLIC_KEY),
    privateKey: Array.from(PRIVATE_KEY),
    metadata: {
        origin: 'https://webauthn.io',
        userHandle: 'Zoë',
        userId: 'dXNlcg',
        count: 2,
    },
    ...overrides,
})

const provider = (json: object) =>
    sealNativeCredentialRecord(subtle, MASTER_KEY, json)

const base64urlJson = (json: object): string =>
    base64url.encode(new TextEncoder().encode(JSON.stringify(json)))

let masterKeyForRead: ReturnType<typeof vi.fn>

const deps = (storage: FakeKeychainStorage) => ({
    storage,
    subtle,
    masterKeyForRead: masterKeyForRead as unknown as () => Promise<Uint8Array>,
})

const readK = (storage: FakeKeychainStorage, id = CRED_ID) =>
    JSON.parse(storage.getString(`k/${id}`)!) as Record<string, unknown>

beforeEach(() => {
    resetDecoded()
    masterKeyForRead = vi.fn(async () => Uint8Array.from(MASTER_KEY))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('splitFlatPasskeyCredentials', () => {
    it('uses an id that exercises base64 punctuation', () => {
        expect(CRED_ID).toMatch(/\+/)
        expect(CRED_ID).toMatch(/\//)
        expect(CRED_ID).toMatch(/=$/)
    })

    it('moves a plain credential into k/ and m/ and removes the flat record', async () => {
        const storage = fakeStorage({
            [CRED_ID]: await provider(credentialJson()),
        })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result).toEqual({ split: [CRED_ID], normalized: [], failed: [] })
        expect(storage.getString(CRED_ID)).toBeUndefined()
        expect(readK(storage)).toMatchObject({
            id: CRED_ID,
            type: 'hd-derived-p256',
            publicKey: { $u8: 'BAQEBA==' },
            metadata: {
                origin: 'https://webauthn.io',
                userHandle: 'Zoë',
                count: 2,
            },
        })
        expect(readK(storage)).not.toHaveProperty('privateKey')
        expect(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(`m/${CRED_ID}`)!,
            ),
        ).toBe(base64.encode(PRIVATE_KEY))
    })

    it('moves a biometric-wrapped credential, keeping only its IV in plaintext', async () => {
        const json = credentialJson({
            privateKey: undefined,
            privateKeyEnc: { iv: IV, data: base64.encode(CIPHERTEXT) },
        })
        const storage = fakeStorage({ [CRED_ID]: await provider(json) })

        await splitFlatPasskeyCredentials(deps(storage))

        expect(readK(storage).privateKeyEnc).toEqual({ iv: IV })
        expect(
            await openData(
                subtle,
                MASTER_KEY,
                storage.getString(`m/${CRED_ID}`)!,
            ),
        ).toBe(base64.encode(CIPHERTEXT))
    })

    it.each([
        [
            'the keystore envelope',
            (json: object) => sealData(subtle, MASTER_KEY, base64urlJson(json)),
        ],
        ['an unsealed payload', async (json: object) => base64urlJson(json)],
        [
            'the legacy type spelling',
            (json: object) => provider({ ...json, type: 'xhd-derived-p256' }),
        ],
    ])('also moves %s', async (_case, payload) => {
        const storage = fakeStorage({
            [CRED_ID]: await payload(credentialJson()),
        })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.split).toEqual([CRED_ID])
        expect(storage.getString(CRED_ID)).toBeUndefined()
    })

    it('leaves a flat record that is not a passkey where it is, wiped from memory', async () => {
        const sealed = await sealCanary13Record(subtle, MASTER_KEY, {
            id: 'seed-1',
            type: 'hd-root-key',
            privateKey: new Uint8Array(32).fill(5),
        })
        const storage = fakeStorage({ 'seed-1': sealed })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result).toEqual(EMPTY)
        expect(storage.entries()).toEqual({ 'seed-1': sealed })
        expect(decodedRecords[0]?.privateKey?.every(byte => byte === 0)).toBe(
            true,
        )
    })

    it('keeps a credential carrying a seed field flat', async () => {
        const flatRecord = await provider(
            credentialJson({ seed: Array.from(new Uint8Array(32).fill(1)) }),
        )
        const storage = fakeStorage({ [CRED_ID]: flatRecord })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.failed).toEqual([CRED_ID])
        expect(storage.getString(CRED_ID)).toBe(flatRecord)
        expect(storage.getString(`k/${CRED_ID}`)).toBeUndefined()
        expect(storage.getString(`m/${CRED_ID}`)).toBeUndefined()
    })

    it('does not read the master key when nothing is flat', async () => {
        const storage = fakeStorage({
            'k/other': '{"id":"other","type":"hd-root-key"}',
            'm/other': 'sealed',
        })

        await splitFlatPasskeyCredentials(deps(storage))

        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it.each([
        ['cannot be read', new Error('keychain locked')],
        ['does not exist', new MasterKeyNotFoundError()],
    ])(
        'changes nothing, for a later launch to retry, when the master key %s',
        async (_case, error) => {
            masterKeyForRead.mockRejectedValue(error)
            const flat = await provider(credentialJson())
            const storage = fakeStorage({ [CRED_ID]: flat })

            const result = await splitFlatPasskeyCredentials(deps(storage))

            expect(result).toEqual(EMPTY)
            expect(storage.entries()).toEqual({ [CRED_ID]: flat })
        },
    )

    it('keeps the flat record and reports the credential when the split does not read back', async () => {
        const flat = await provider(credentialJson())
        const backing = fakeStorage({ [CRED_ID]: flat })
        const storage = {
            ...backing,
            set: (key: string, value: string) =>
                backing.set(
                    key,
                    key.startsWith('k/') ? '{"id":"someone-else"}' : value,
                ),
        }

        const result = await splitFlatPasskeyCredentials({
            ...deps(backing),
            storage,
        })

        expect(result.failed).toEqual([CRED_ID])
        expect(backing.entries()).toEqual({ [CRED_ID]: flat })
    })

    it('finishes a split that was interrupted before the flat copy was removed', async () => {
        const storage = fakeStorage({
            [CRED_ID]: await provider(credentialJson()),
        })
        const split = splitProviderCredential(CRED_ID, {
            id: CRED_ID,
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['sign'],
            name: 'Passkey: https://webauthn.io',
            publicKey: new Uint8Array(PUBLIC_KEY),
            privateKey: new Uint8Array(PRIVATE_KEY),
            metadata: {
                origin: 'https://webauthn.io',
                userHandle: 'Zoë',
                userId: 'dXNlcg',
                count: 2,
            },
        })!
        await writeSplitProviderCredential(
            { storage, subtle },
            MASTER_KEY,
            CRED_ID,
            split,
        )

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.split).toEqual([CRED_ID])
        expect(storage.getString(CRED_ID)).toBeUndefined()
    })

    it('leaves both copies alone when a different k/ record holds the id', async () => {
        const flat = await provider(credentialJson())
        const conflicting = serializeKey({
            id: CRED_ID,
            type: 'hd-derived-p256',
            publicKey: new Uint8Array(4).fill(6),
            metadata: { origin: 'https://webauthn.io' },
        } as unknown as Key)
        const storage = fakeStorage({
            [CRED_ID]: flat,
            [`k/${CRED_ID}`]: conflicting,
        })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.failed).toEqual([CRED_ID])
        expect(storage.entries()).toEqual({
            [CRED_ID]: flat,
            [`k/${CRED_ID}`]: conflicting,
        })
    })

    it('keeps a record whose id disagrees with its storage key flat', async () => {
        const flat = await provider(credentialJson({ id: 'somewhere-else' }))
        const storage = fakeStorage({ [CRED_ID]: flat })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.failed).toEqual([CRED_ID])
        expect(storage.entries()).toEqual({ [CRED_ID]: flat })
    })

    it('keeps a record the provider could never list flat', async () => {
        const flat = await provider(
            credentialJson({ metadata: { userHandle: 'Zoë' } }),
        )
        const storage = fakeStorage({ [CRED_ID]: flat })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.failed).toEqual([CRED_ID])
        expect(storage.entries()).toEqual({ [CRED_ID]: flat })
    })

    it('moves top-level fields of an as-adopted k/ record under metadata', async () => {
        const storage = fakeStorage({
            'k/cred-9': serializeKey({
                id: 'cred-9',
                type: 'hd-derived-p256',
                publicKey: PUBLIC_KEY,
                origin: 'https://a.example',
                userHandle: 'bob',
                metadata: {},
            } as unknown as Key),
        })

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result.normalized).toEqual(['cred-9'])
        expect(readK(storage, 'cred-9')).toEqual({
            id: 'cred-9',
            type: 'hd-derived-p256',
            publicKey: { $u8: 'BAQEBA==' },
            metadata: { origin: 'https://a.example', userHandle: 'bob' },
        })
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('does nothing on the next launch once everything is split', async () => {
        const storage = fakeStorage({
            [CRED_ID]: await provider(credentialJson()),
        })
        await splitFlatPasskeyCredentials(deps(storage))
        const after = storage.entries()
        masterKeyForRead.mockClear()

        const result = await splitFlatPasskeyCredentials(deps(storage))

        expect(result).toEqual(EMPTY)
        expect(storage.entries()).toEqual(after)
        expect(masterKeyForRead).not.toHaveBeenCalled()
    })

    it('wipes the decrypted private key and the master key once done', async () => {
        const masterKey = Uint8Array.from(MASTER_KEY)
        masterKeyForRead.mockResolvedValue(masterKey)
        const storage = fakeStorage({
            [CRED_ID]: await provider(credentialJson()),
        })

        await splitFlatPasskeyCredentials(deps(storage))

        expect(decodedRecords[0]?.privateKey?.every(byte => byte === 0)).toBe(
            true,
        )
        expect(masterKey.every(byte => byte === 0)).toBe(true)
    })

    it('never throws, even when storage itself fails', async () => {
        const storage = {
            ...fakeStorage(),
            getAllKeys: () => {
                throw new Error('mmkv gone')
            },
        }

        await expect(
            splitFlatPasskeyCredentials({ ...deps(fakeStorage()), storage }),
        ).resolves.toEqual(EMPTY)
    })

    it('reports a key that cannot be read and carries on with the rest', async () => {
        const unreadable = credentialId(1)
        const backing = fakeStorage({
            [unreadable]: await provider(credentialJson({ id: unreadable })),
            [CRED_ID]: await provider(credentialJson()),
        })
        const storage = {
            ...backing,
            getString: (key: string) => {
                if (key === unreadable) throw new Error('mmkv read failed')
                return backing.getString(key)
            },
        }

        const result = await splitFlatPasskeyCredentials({
            ...deps(backing),
            storage,
        })

        expect(result.split).toEqual([CRED_ID])
        expect(result.failed).toEqual([unreadable])
        expect(backing.getString(CRED_ID)).toBeUndefined()
        expect(backing.getString(`k/${CRED_ID}`)).toBeDefined()
    })
})
