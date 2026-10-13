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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openNativeProviderRecord } from '../nativeProviderRecord'

const { platformMock, masterKeyMock, storageMock, writeSplitMock } = vi.hoisted(
    () => ({
        platformMock: { OS: 'android' as 'android' | 'ios' },
        masterKeyMock: vi.fn(async () => new Uint8Array(32)),
        storageMock: { set: vi.fn(), getString: vi.fn() },
        writeSplitMock: vi.fn(
            async (_masterKey: Uint8Array, _id: string, _record: unknown) =>
                undefined,
        ),
    }),
)

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        deviceInfo: { getDevicePlatform: () => platformMock.OS },
    }),
    keystoreSubtle: {},
    writePasskeyCredential: writeSplitMock,
}))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: masterKeyMock,
    storage: storageMock,
    METADATA_PREFIX: 'k/',
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

import {
    createNativePasskeyWriter,
    nativePasskeyEntryExists,
    writeNativePasskeyEntry,
    type WriteNativePasskeyEntryParams,
} from '../writeNativePasskeyEntry'
import { subscribeToPasskeyChanges } from '../passkeyChanges'

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

/** The record the provider would read back for the last write. */
const lastWrittenRecord = async () => {
    const [, payload] = storageMock.set.mock.calls.at(-1) as [string, string]
    return (await openNativeProviderRecord(
        subtle,
        MASTER_KEY,
        payload,
    )) as Record<string, unknown>
}

// `passkeyBackupInputs` reads the seed key id back out of `parentKeyId` and the
// derivation counter out of `counter`; a record missing either can never be
// proven reproducible again.
const writeWithBackupLinkage = async () => {
    platformMock.OS = 'ios'
    await writeNativePasskeyEntry(
        {
            ...entryParams('cred-linked'),
            identity: 'iosrestore',
            parentKeyId: 'seed-1-passkey-main',
            counter: 4,
        },
        subtle,
    )
    const record = await lastWrittenRecord()
    return record.metadata as Record<string, unknown>
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
    if (os === 'android') {
        const [, , record] = writeSplitMock.mock.calls.at(-1) as [
            Uint8Array,
            string,
            { metadata: Record<string, unknown> },
        ]
        return record.metadata
    }
    const record = await lastWrittenRecord()
    return record.metadata as Record<string, unknown>
}

beforeEach(() => {
    platformMock.OS = 'ios'
    storageMock.set.mockClear()
    storageMock.getString.mockReset()
    masterKeyMock.mockClear()
    masterKeyMock.mockImplementation(async () => Uint8Array.from(MASTER_KEY))
    writeSplitMock.mockClear()
})

describe('writeNativePasskeyEntry provider contract', () => {
    it('iOS: writes an envelope the provider can decrypt, with byte fields as number arrays', async () => {
        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)

        const [key, payload] = storageMock.set.mock.calls.at(-1) as [
            string,
            string,
        ]
        expect(key).toBe('cred-1')
        // `openNativeProviderRecord` requires all three fields — a two-field
        // `{iv, content}` envelope throws instead of decrypting.
        expect(Object.keys(JSON.parse(payload)).sort()).toEqual([
            'content',
            'iv',
            'tag',
        ])

        const record = await lastWrittenRecord()
        // `getJSONArray("privateKey")` — not `{$u8}`, and not the object a bare
        // `JSON.stringify(Uint8Array)` would produce.
        expect(record.privateKey).toEqual(
            Array.from(new Uint8Array(32).fill(3)),
        )
        expect(record.publicKey).toEqual(Array.from(new Uint8Array(91).fill(4)))
        expect(record.type).toBe('hd-derived-p256')
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

    it('Android: stores a standard-base64 user.id as unpadded base64url, the only alphabet its assertion decodes', async () => {
        platformMock.OS = 'android'
        await writeNativePasskeyEntry(
            {
                ...entryParams('cred-1'),
                userId: 'a+b/cw==',
                userName: undefined,
            },
            subtle,
        )

        const [, , record] = writeSplitMock.mock.calls.at(-1) as [
            Uint8Array,
            string,
            { metadata: Record<string, unknown> },
        ]
        expect(record.metadata.userId).toBe('a-b_cw')
        expect(record.metadata.userHandle).toBe('a-b_cw')
    })

    it('iOS: keeps a standard-base64 user.id as written', async () => {
        await writeNativePasskeyEntry(
            { ...entryParams('cred-1'), userId: 'a+b/cw==' },
            subtle,
        )

        const record = await lastWrittenRecord()
        expect((record.metadata as Record<string, unknown>).userId).toBe(
            'a+b/cw==',
        )
    })
})

describe('createNativePasskeyWriter master-key reuse', () => {
    it('fetches the master key once and reuses it across writes', async () => {
        const write = createNativePasskeyWriter(subtle)

        await write(entryParams('cred-1'))
        await write(entryParams('cred-2'))
        await write(entryParams('cred-3'))

        expect(masterKeyMock).toHaveBeenCalledTimes(1)
        expect(storageMock.set).toHaveBeenCalledTimes(3)
    })

    it('does not cache a failed fetch, so a later write retries', async () => {
        masterKeyMock.mockRejectedValueOnce(new Error('keychain locked'))
        const write = createNativePasskeyWriter(subtle)

        await expect(write(entryParams('cred-1'))).rejects.toThrow(
            'keychain locked',
        )
        await write(entryParams('cred-2'))

        expect(masterKeyMock).toHaveBeenCalledTimes(2)
        expect(storageMock.set).toHaveBeenCalledTimes(1)
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

    it('stores the parent key id and derivation counter it was given', async () => {
        masterKeyMock.mockResolvedValue(Uint8Array.from(MASTER_KEY))

        const metadata = await writeWithBackupLinkage()

        expect(metadata.parentKeyId).toBe('seed-1-passkey-main')
        expect(metadata.counter).toBe(4)
        expect(metadata.identity).toBe('iosrestore')
    })

    // The WebAuthn signature counter and the derivation counter diverge as soon
    // as the credential is used, so they cannot share one field.
    it('keeps the derivation counter separate from the signature counter', async () => {
        masterKeyMock.mockResolvedValue(Uint8Array.from(MASTER_KEY))
        platformMock.OS = 'ios'

        await writeNativePasskeyEntry(
            { ...entryParams('cred-2'), counter: 4, count: 0 },
            subtle,
        )
        const record = await lastWrittenRecord()
        const metadata = record.metadata as Record<string, unknown>

        expect(metadata.counter).toBe(4)
        expect(metadata.count).toBe(0)
    })

    it('stores the creation time it was given, and none when given none', async () => {
        // Each write zeroes the master key it was handed.
        masterKeyMock.mockImplementation(async () =>
            Uint8Array.from(MASTER_KEY),
        )
        platformMock.OS = 'ios'

        await writeNativePasskeyEntry(
            { ...entryParams('cred-3'), createdAtMs: 1_700_000_000_123 },
            subtle,
        )
        const stamped = (await lastWrittenRecord()).metadata as Record<
            string,
            unknown
        >
        await writeNativePasskeyEntry(entryParams('cred-4'), subtle)
        const unstamped = (await lastWrittenRecord()).metadata as Record<
            string,
            unknown
        >

        expect(stamped.createdAt).toBe(1_700_000_000_123)
        expect(unstamped).not.toHaveProperty('createdAt')
    })
})

describe('writeNativePasskeyEntry change notification', () => {
    it('announces a credential once its record is stored', async () => {
        const recordsStoredAtAnnouncement: number[] = []
        const unsubscribe = subscribeToPasskeyChanges(() => {
            recordsStoredAtAnnouncement.push(storageMock.set.mock.calls.length)
        })

        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)
        unsubscribe()

        expect(recordsStoredAtAnnouncement).toEqual([1])
    })
})

describe('writeNativePasskeyEntry on Android', () => {
    it('writes the credential split through the provider, never as a flat record', async () => {
        platformMock.OS = 'android'
        // `dispose` zeroes the master key once the write returns, so keep a copy.
        let capturedMasterKey: Uint8Array | undefined
        writeSplitMock.mockImplementationOnce(async (masterKey: Uint8Array) => {
            capturedMasterKey = Uint8Array.from(masterKey)
            return undefined
        })

        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)

        expect(storageMock.set).not.toHaveBeenCalled()
        expect(capturedMasterKey).toEqual(MASTER_KEY)
        const [, id, record] = writeSplitMock.mock.calls.at(-1) as [
            Uint8Array,
            string,
            Record<string, unknown>,
        ]
        expect(id).toBe('cred-1')
        expect(record.privateKey).toEqual(new Uint8Array(32).fill(3))
        expect(record.publicKey).toEqual(new Uint8Array(91).fill(4))
        expect(record.type).toBe('hd-derived-p256')
    })
})

describe('nativePasskeyEntryExists', () => {
    it('on Android, sees a flat record and a split one alike', () => {
        platformMock.OS = 'android'
        storageMock.getString.mockImplementation((key: string) =>
            key === 'flat-1' || key === 'k/split-1' ? '{}' : undefined,
        )

        expect(nativePasskeyEntryExists('flat-1')).toBe(true)
        expect(nativePasskeyEntryExists('split-1')).toBe(true)
        expect(nativePasskeyEntryExists('missing')).toBe(false)
    })

    it('on iOS, sees a flat record but not a split one', () => {
        storageMock.getString.mockImplementation((key: string) =>
            key === 'flat-1' || key === 'k/split-1' ? '{}' : undefined,
        )

        expect(nativePasskeyEntryExists('flat-1')).toBe(true)
        expect(nativePasskeyEntryExists('split-1')).toBe(false)
    })
})
