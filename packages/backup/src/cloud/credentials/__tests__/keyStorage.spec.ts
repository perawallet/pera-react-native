/*
 Copyright 2022-2025 Pera Wallet, LDA
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

const { commitSecretMock, removeSecretMock, withSecretMock } = vi.hoisted(
    () => ({
        commitSecretMock: vi.fn(async () => undefined),
        removeSecretMock: vi.fn(async () => undefined),
        withSecretMock: vi.fn(),
    }),
)

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret: commitSecretMock,
    removeSecret: removeSecretMock,
    withSecret: withSecretMock,
}))

import {
    CLOUD_BACKUP_AUTH_KEY_ID,
    CLOUD_BACKUP_ENC_KEY_ID,
    CLOUD_BACKUP_MNEMONIC_ID,
    deleteBackupKeys,
    persistBackupKeys,
    withBackupEncryptionKey,
    withBackupMnemonic,
} from '../keyStorage'

const MNEMONIC = ['marble', 'protect', 'crawl']

describe('persistBackupKeys', () => {
    beforeEach(() => {
        commitSecretMock.mockReset()
        commitSecretMock.mockResolvedValue(undefined)
        removeSecretMock.mockClear()
        removeSecretMock.mockResolvedValue(undefined)
    })

    test('commits the encryption key, auth secret key, and mnemonic under stable ids', async () => {
        const encryptionKey = new Uint8Array(32).fill(1)
        const authSecretKey = new Uint8Array(64).fill(2)

        await persistBackupKeys({
            encryptionKey,
            authSecretKey,
            mnemonic: MNEMONIC,
        })

        expect(commitSecretMock).toHaveBeenCalledWith({
            id: CLOUD_BACKUP_ENC_KEY_ID,
            bytes: encryptionKey,
        })
        expect(commitSecretMock).toHaveBeenCalledWith({
            id: CLOUD_BACKUP_AUTH_KEY_ID,
            bytes: authSecretKey,
        })
        expect(commitSecretMock).toHaveBeenCalledWith({
            id: CLOUD_BACKUP_MNEMONIC_ID,
            bytes: new TextEncoder().encode(MNEMONIC.join(' ')),
        })
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

describe('withBackupMnemonic', () => {
    beforeEach(() => {
        withSecretMock.mockReset()
    })

    test('decodes the stored bytes into words and passes them to the handler', async () => {
        withSecretMock.mockImplementation(
            async (_id: string, handler: (bytes: Uint8Array) => unknown) =>
                handler(new TextEncoder().encode(MNEMONIC.join(' '))),
        )

        const words = await withBackupMnemonic(resolved => resolved)

        expect(withSecretMock).toHaveBeenCalledWith(
            CLOUD_BACKUP_MNEMONIC_ID,
            expect.any(Function),
        )
        expect(words).toEqual(MNEMONIC)
    })

    test('returns null when no mnemonic is stored', async () => {
        withSecretMock.mockResolvedValue(null)

        const result = await withBackupMnemonic(resolved => resolved)

        expect(result).toBeNull()
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
