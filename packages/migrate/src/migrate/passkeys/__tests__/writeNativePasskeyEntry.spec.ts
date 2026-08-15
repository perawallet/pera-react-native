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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    platformMock,
    masterKeyMock,
    storageMock,
    base64,
    METADATA_PREFIX,
    MATERIAL_PREFIX,
} = vi.hoisted(() => {
    // Standard base64, matching `@scure/base`'s `base64` — restated locally
    // rather than imported so this package needs no bundler-visible
    // dependency for it.
    const base64Impl = {
        encode: (bytes: Uint8Array): string =>
            btoa(String.fromCharCode(...bytes)),
        decode: (value: string): Uint8Array =>
            Uint8Array.from(atob(value), char => char.charCodeAt(0)),
    }

    return {
        platformMock: { OS: 'android' as 'android' | 'ios' },
        masterKeyMock: vi.fn(async () => new Uint8Array(32)),
        storageMock: { set: vi.fn(), getString: vi.fn() },
        base64: base64Impl,
        METADATA_PREFIX: 'k/',
        MATERIAL_PREFIX: 'm/',
    }
})

vi.mock('react-native', () => ({ Platform: platformMock }))
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

// Restated over the real primitives rather than imported: the real keystore
// barrel pulls react-native-mmkv, which has no loadable build here (see
// bootstrapPasskeyAutofill.spec.ts for the same constraint).
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: masterKeyMock,
    storage: storageMock,
    METADATA_PREFIX,
    MATERIAL_PREFIX,
    serializeKey: (key: Record<string, unknown>) =>
        JSON.stringify(key, (_k, value) =>
            value instanceof Uint8Array ? { $u8: base64.encode(value) } : value,
        ),
    sealData: async (
        subtle: SubtleCrypto,
        key: Uint8Array,
        data: string,
    ): Promise<string> => {
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const ciphertext = new Uint8Array(
            await subtle.encrypt(
                { name: 'AES-GCM', iv },
                await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [
                    'encrypt',
                ]),
                new TextEncoder().encode(data),
            ),
        )
        return JSON.stringify({
            iv: base64.encode(iv),
            content: base64.encode(ciphertext),
        })
    },
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

/** Reverses the restated `serializeKey` above, restoring `Uint8Array` fields. */
const decode = (data: string): Record<string, unknown> =>
    JSON.parse(data, (_k, value) =>
        value && typeof value === 'object' && typeof value.$u8 === 'string'
            ? base64.decode(value.$u8)
            : value,
    )

/** Reverses the restated `sealData` above. */
const openData = async (
    subtle: SubtleCrypto,
    key: Uint8Array,
    payload: string,
): Promise<string> => {
    const { iv, content } = JSON.parse(payload)
    return new TextDecoder().decode(
        await subtle.decrypt(
            { name: 'AES-GCM', iv: base64.decode(iv) },
            await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, [
                'decrypt',
            ]),
            base64.decode(content),
        ),
    )
}

import {
    createNativePasskeyWriter,
    writeNativePasskeyEntry,
    type WriteNativePasskeyEntryParams,
} from '../writeNativePasskeyEntry'

const OPAQUE_USER_ID = 'dXNlci1pZA' // WebAuthn user.id (base64, opaque)
const HUMAN_USER_NAME = 'alice@example.com' // WebAuthn user.name (display)

const subtle = globalThis.crypto.subtle
/** Every test's master key, so a written record can be opened back up. */
const MASTER_KEY = new Uint8Array(32).fill(7)

const entryParams = (credentialId: string): WriteNativePasskeyEntryParams => ({
    credentialId,
    origin: 'https://webauthn.io',
    userId: OPAQUE_USER_ID,
    userName: HUMAN_USER_NAME,
    publicKeySpkiDer: new Uint8Array(91).fill(4),
    privateKey: new Uint8Array(32).fill(3),
})

const setCallFor = (prefix: string) => {
    const call = storageMock.set.mock.calls.find(([key]) =>
        (key as string).startsWith(prefix),
    ) as [string, string] | undefined
    if (!call) throw new Error(`no storage.set call for prefix ${prefix}`)
    return call
}

type WrittenKeyMetadata = {
    id: string
    type: string
    publicKey?: Uint8Array
    metadata?: Record<string, unknown>
}

/** The plaintext metadata record written to `k/<id>`. */
const lastWrittenMetadata = (): WrittenKeyMetadata => {
    const [, payload] = setCallFor(METADATA_PREFIX)
    return decode(payload) as WrittenKeyMetadata
}

/** The raw private-key bytes sealed at `m/<id>`, opened back with the test master key. */
const lastWrittenMaterial = async (): Promise<Uint8Array> => {
    const [, payload] = setCallFor(MATERIAL_PREFIX)
    const base64Payload = await openData(subtle, MASTER_KEY, payload)
    return Uint8Array.from(Buffer.from(base64Payload, 'base64'))
}

const writeFor = async (os: 'android' | 'ios') => {
    platformMock.OS = os
    await writeNativePasskeyEntry(
        {
            ...entryParams('cred-1'),
            displayName: 'Alice',
        },
        subtle,
    )
    const record = lastWrittenMetadata()
    return record.metadata as Record<string, unknown>
}

beforeEach(() => {
    storageMock.set.mockClear()
    masterKeyMock.mockClear()
    masterKeyMock.mockImplementation(async () => Uint8Array.from(MASTER_KEY))
})

describe('writeNativePasskeyEntry split-layout contract', () => {
    it('writes metadata and material in the split layout', async () => {
        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)

        const [metadataKey] = setCallFor(METADATA_PREFIX)
        const [materialKey] = setCallFor(MATERIAL_PREFIX)
        expect(metadataKey).toBe(`${METADATA_PREFIX}cred-1`)
        expect(materialKey).toBe(`${MATERIAL_PREFIX}cred-1`)

        const metadata = lastWrittenMetadata()
        expect(metadata.type).toBe('hd-derived-p256')
        expect(metadata.publicKey).toEqual(new Uint8Array(91).fill(4))

        const material = await lastWrittenMaterial()
        expect(material).toEqual(new Uint8Array(32).fill(3))
    })

    it('writes nothing at the bare id', async () => {
        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)

        expect(storageMock.getString('cred-1')).toBeUndefined()
        expect(
            storageMock.set.mock.calls.some(([key]) => key === 'cred-1'),
        ).toBe(false)
    })

    it('carries an arbitrary metadata value across verbatim', async () => {
        // `serializeKey`'s replacer only special-cases `Uint8Array`; every other
        // value — including an object, which is what a biometric-gated
        // credential's wrapped key looks like — passes through untouched. A
        // secret-lifter that only understood byte arrays would drop it instead.
        const wrappedLike = { iv: 'aXY=', data: 'ZGF0YQ==' }
        await writeNativePasskeyEntry(
            {
                ...entryParams('cred-1'),
                displayName: JSON.stringify(wrappedLike),
            },
            subtle,
        )

        const metadata = lastWrittenMetadata()
        expect(JSON.parse(metadata.metadata?.displayName as string)).toEqual(
            wrappedLike,
        )
    })
})

describe('writeNativePasskeyEntry metadata mapping', () => {
    it('Android: metadata.userHandle is the human-readable user.name (the OS picker label)', async () => {
        const metadata = await writeFor('android')

        expect(metadata.userHandle).toBe(HUMAN_USER_NAME)
        expect(metadata.userId).toBe(OPAQUE_USER_ID)
    })

    it('iOS: metadata.userHandle is the opaque user.id, display comes from userName', async () => {
        const metadata = await writeFor('ios')

        expect(metadata.userHandle).toBe(OPAQUE_USER_ID)
        expect(metadata.userId).toBe(OPAQUE_USER_ID)
        expect(metadata.userName).toBe(HUMAN_USER_NAME)
    })
})

describe('createNativePasskeyWriter master-key reuse', () => {
    it('fetches the master key once and reuses it across writes', async () => {
        const write = createNativePasskeyWriter(subtle)

        await write(entryParams('cred-1'))
        await write(entryParams('cred-2'))
        await write(entryParams('cred-3'))

        expect(masterKeyMock).toHaveBeenCalledTimes(1)
        // Two `storage.set` calls per write: `k/<id>` metadata + `m/<id>` material.
        expect(storageMock.set).toHaveBeenCalledTimes(6)
    })

    it('does not cache a failed fetch, so a later write retries', async () => {
        masterKeyMock.mockRejectedValueOnce(new Error('keychain locked'))
        const write = createNativePasskeyWriter(subtle)

        await expect(write(entryParams('cred-1'))).rejects.toThrow(
            'keychain locked',
        )
        await write(entryParams('cred-2'))

        expect(masterKeyMock).toHaveBeenCalledTimes(2)
        expect(storageMock.set).toHaveBeenCalledTimes(2)
    })

    it('dispose zeroes the cached master key', async () => {
        const masterKey = Uint8Array.from(MASTER_KEY)
        masterKeyMock.mockResolvedValue(masterKey)
        const write = createNativePasskeyWriter(subtle)

        await write(entryParams('cred-1'))
        await write.dispose()

        expect(masterKey.every(byte => byte === 0)).toBe(true)
    })

    it('dispose resolves as a no-op when no master key was fetched', async () => {
        const write = createNativePasskeyWriter(subtle)

        await expect(write.dispose()).resolves.toBeUndefined()
        expect(masterKeyMock).not.toHaveBeenCalled()
    })
})
