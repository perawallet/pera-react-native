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
import { openNativeProviderRecord } from '@perawallet/wallet-core-passkeys/native'

const { platformMock, masterKeyMock, storageMock } = vi.hoisted(() => ({
    platformMock: { OS: 'android' as 'android' | 'ios' },
    masterKeyMock: vi.fn(async () => new Uint8Array(32)),
    storageMock: { set: vi.fn(), getString: vi.fn() },
}))

vi.mock('react-native', () => ({ Platform: platformMock }))
vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    readMasterKey: masterKeyMock,
    storage: storageMock,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) if (buf) buf.fill(0)
    },
}))

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

/** The record the provider would read back for the last write. */
const lastWrittenRecord = async () => {
    const [, payload] = storageMock.set.mock.calls.at(-1) as [string, string]
    return (await openNativeProviderRecord(
        subtle,
        MASTER_KEY,
        payload,
    )) as Record<string, unknown>
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
    const record = await lastWrittenRecord()
    return record.metadata as Record<string, unknown>
}

beforeEach(() => {
    storageMock.set.mockClear()
    masterKeyMock.mockClear()
    masterKeyMock.mockImplementation(async () => Uint8Array.from(MASTER_KEY))
})

describe('writeNativePasskeyEntry provider contract', () => {
    it('writes an envelope the provider can decrypt, with byte fields as number arrays', async () => {
        await writeNativePasskeyEntry(entryParams('cred-1'), subtle)

        const [key, payload] = storageMock.set.mock.calls.at(-1) as [
            string,
            string,
        ]
        expect(key).toBe('cred-1')
        // `decodeKeyData` only takes its decrypt branch on all three fields;
        // canary.14's two-field `{iv, content}` silently returns the envelope.
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
})
