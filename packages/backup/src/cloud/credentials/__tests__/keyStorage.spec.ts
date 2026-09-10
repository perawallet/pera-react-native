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

import { describe, test, expect, vi, beforeEach } from 'vitest'

const {
    MNEMONIC,
    commitSecretMock,
    removeSecretMock,
    withSecretMock,
    hasSecretMock,
} = vi.hoisted(() => ({
    MNEMONIC: ['marble', 'protect', 'crawl'],
    commitSecretMock: vi.fn(
        async (_params: { id: string; bytes: Uint8Array }) => undefined,
    ),
    removeSecretMock: vi.fn(async (_id: string) => undefined),
    withSecretMock: vi.fn(),
    hasSecretMock: vi.fn(() => false),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: commitSecretMock,
    removeSecret: removeSecretMock,
    withSecret: withSecretMock,
    hasSecret: hasSecretMock,
    // Stand-ins for the real wordlist lookups; only the round-trip matters here.
    mnemonicWordsToIndices: (words: string[]) => {
        const indices = new Uint16Array(words.length)
        for (let i = 0; i < words.length; i++) {
            const index = MNEMONIC.indexOf(words[i])
            if (index < 0) return null
            indices[i] = index
        }
        return indices
    },
    zeroBytes: (...buffers: Array<Uint16Array | Uint8Array | null>) => {
        for (const buffer of buffers) buffer?.fill(0)
    },
}))

import {
    BackupMnemonicParseError,
    CLOUD_BACKUP_AUTH_KEY_ID,
    CLOUD_BACKUP_ENC_KEY_ID,
    CLOUD_BACKUP_MNEMONIC_ID,
    deleteBackupKeys,
    hasBackupCredentials,
    persistBackupKeys,
    withBackupEncryptionKey,
    withBackupMnemonicIndices,
} from '../keyStorage'

describe('persistBackupKeys', () => {
    beforeEach(() => {
        commitSecretMock.mockReset()
        commitSecretMock.mockResolvedValue(undefined)
        removeSecretMock.mockClear()
        removeSecretMock.mockResolvedValue(undefined)
    })

    // Snapshot at call time: the phrase buffer is zeroed before the call returns.
    // Plain arrays because jsdom's `TextEncoder` yields another realm's `Uint8Array`.
    const captureCommits = (): Map<string, number[]> => {
        const committed = new Map<string, number[]>()
        commitSecretMock.mockImplementation(async ({ id, bytes }) => {
            committed.set(id, Array.from(bytes))
            return undefined
        })
        return committed
    }

    test('commits the encryption key, auth secret key, and mnemonic under stable ids', async () => {
        const encryptionKey = new Uint8Array(32).fill(1)
        const authSecretKey = new Uint8Array(64).fill(2)
        const committed = captureCommits()

        await persistBackupKeys({
            encryptionKey,
            authSecretKey,
            mnemonic: MNEMONIC,
        })

        expect(committed.get(CLOUD_BACKUP_ENC_KEY_ID)).toEqual(
            Array.from(encryptionKey),
        )
        expect(committed.get(CLOUD_BACKUP_AUTH_KEY_ID)).toEqual(
            Array.from(authSecretKey),
        )
        expect(committed.get(CLOUD_BACKUP_MNEMONIC_ID)).toEqual(
            Array.from(new TextEncoder().encode(MNEMONIC.join(' '))),
        )
    })

    test('zeroes the encoded phrase once it is committed', async () => {
        const handed: Uint8Array[] = []
        commitSecretMock.mockImplementation(async ({ id, bytes }) => {
            if (id === CLOUD_BACKUP_MNEMONIC_ID) handed.push(bytes)
            return undefined
        })

        await persistBackupKeys({
            encryptionKey: new Uint8Array(32).fill(1),
            authSecretKey: new Uint8Array(64).fill(2),
            mnemonic: MNEMONIC,
        })

        expect(handed).toHaveLength(1)
        expect(handed[0].every(byte => byte === 0)).toBe(true)
    })

    test('zeroes the encoded phrase even when the commit fails', async () => {
        const handed: Uint8Array[] = []
        commitSecretMock.mockImplementation(async ({ id, bytes }) => {
            if (id !== CLOUD_BACKUP_MNEMONIC_ID) return undefined
            handed.push(bytes)
            throw new Error('keystore full')
        })

        await expect(
            persistBackupKeys({
                encryptionKey: new Uint8Array(32).fill(1),
                authSecretKey: new Uint8Array(64).fill(2),
                mnemonic: MNEMONIC,
            }),
        ).rejects.toThrow('keystore full')

        expect(handed).toHaveLength(1)
        expect(handed[0].every(byte => byte === 0)).toBe(true)
    })

    test('rolls back the encryption key when the auth key commit fails', async () => {
        commitSecretMock
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('keystore full'))

        await expect(
            persistBackupKeys({
                encryptionKey: new Uint8Array(32).fill(1),
                authSecretKey: new Uint8Array(64).fill(2),
                mnemonic: MNEMONIC,
            }),
        ).rejects.toThrow('keystore full')

        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_ENC_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
    })

    test('rolls back both keys when the mnemonic commit fails', async () => {
        commitSecretMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error('keystore full'))

        await expect(
            persistBackupKeys({
                encryptionKey: new Uint8Array(32).fill(1),
                authSecretKey: new Uint8Array(64).fill(2),
                mnemonic: MNEMONIC,
            }),
        ).rejects.toThrow('keystore full')

        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_ENC_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
    })
})

describe('withBackupMnemonicIndices', () => {
    const storedPhrase = () => new TextEncoder().encode(MNEMONIC.join(' '))

    beforeEach(() => {
        withSecretMock.mockReset()
        withSecretMock.mockImplementation(
            async (_id: string, handler: (bytes: Uint8Array) => unknown) =>
                handler(storedPhrase()),
        )
    })

    test('decodes the stored bytes into wordlist indices for the handler', async () => {
        const indices = await withBackupMnemonicIndices(resolved =>
            Array.from(resolved),
        )

        expect(withSecretMock).toHaveBeenCalledWith(
            CLOUD_BACKUP_MNEMONIC_ID,
            expect.any(Function),
        )
        expect(indices).toEqual([0, 1, 2])
    })

    test('zeroes the index buffer once the handler returns', async () => {
        let leaked: Uint16Array | null = null

        await withBackupMnemonicIndices(resolved => {
            leaked = resolved
        })

        expect(Array.from(leaked!)).toEqual([0, 0, 0])
    })

    test('waits for an async handler before zeroing', async () => {
        const seen = await withBackupMnemonicIndices(async resolved => {
            await Promise.resolve()
            return Array.from(resolved)
        })

        expect(seen).toEqual([0, 1, 2])
    })

    test('returns null when no mnemonic is stored', async () => {
        withSecretMock.mockResolvedValue(null)

        const result = await withBackupMnemonicIndices(resolved => resolved)

        expect(result).toBeNull()
    })

    test('throws BackupMnemonicParseError when the stored phrase is not a wordlist phrase', async () => {
        withSecretMock.mockImplementation(
            async (_id: string, handler: (bytes: Uint8Array) => unknown) =>
                handler(new TextEncoder().encode('not a wordlist phrase')),
        )

        await expect(
            withBackupMnemonicIndices(resolved => resolved),
        ).rejects.toBeInstanceOf(BackupMnemonicParseError)
    })

    test('does not invoke the handler when the stored phrase cannot be decoded', async () => {
        withSecretMock.mockImplementation(
            async (_id: string, handler: (bytes: Uint8Array) => unknown) =>
                handler(new TextEncoder().encode('not a wordlist phrase')),
        )
        const handler = vi.fn()

        await expect(withBackupMnemonicIndices(handler)).rejects.toThrow()
        expect(handler).not.toHaveBeenCalled()
    })
})

describe('withBackupEncryptionKey', () => {
    beforeEach(() => {
        withSecretMock.mockReset()
    })

    test('passes the stored bytes to the handler and returns the result', async () => {
        const encBytes = new Uint8Array(32).fill(7)
        withSecretMock.mockImplementation(
            async (_id: string, handler: (bytes: Uint8Array) => unknown) =>
                handler(encBytes),
        )

        const result = await withBackupEncryptionKey(bytes => bytes)

        expect(withSecretMock).toHaveBeenCalledWith(
            CLOUD_BACKUP_ENC_KEY_ID,
            expect.any(Function),
        )
        expect(result).toBe(encBytes)
    })

    test('returns null when no encryption key is stored', async () => {
        withSecretMock.mockResolvedValue(null)

        const result = await withBackupEncryptionKey(bytes => bytes)

        expect(result).toBeNull()
    })
})

describe('deleteBackupKeys', () => {
    beforeEach(() => {
        removeSecretMock.mockClear()
    })

    test('removes all stored backup secrets', async () => {
        await deleteBackupKeys()

        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_ENC_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_MNEMONIC_ID)
    })

    test('attempts every removal and rethrows when one fails', async () => {
        const failure = new Error('keystore busy')
        removeSecretMock.mockImplementation(async (id: string) => {
            if (id === CLOUD_BACKUP_AUTH_KEY_ID) throw failure
        })

        await expect(deleteBackupKeys()).rejects.toThrow('keystore busy')

        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_ENC_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
        expect(removeSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_MNEMONIC_ID)
    })
})

describe('hasBackupCredentials', () => {
    beforeEach(() => {
        hasSecretMock.mockReset()
        hasSecretMock.mockReturnValue(false)
    })

    test('returns false when the auth key is not present', () => {
        expect(hasBackupCredentials()).toBe(false)
        expect(hasSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
    })

    test('returns true when the auth key is present', () => {
        hasSecretMock.mockReturnValue(true)
        expect(hasBackupCredentials()).toBe(true)
        expect(hasSecretMock).toHaveBeenCalledWith(CLOUD_BACKUP_AUTH_KEY_ID)
    })
})
