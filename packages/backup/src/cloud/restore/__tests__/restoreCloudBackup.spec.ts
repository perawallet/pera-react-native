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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

const {
    deriveBackupKeysMock,
    persistBackupKeysMock,
    deleteBackupKeysMock,
    pullBackupItemsMock,
} = vi.hoisted(() => ({
    deriveBackupKeysMock: vi.fn(),
    persistBackupKeysMock: vi.fn(),
    deleteBackupKeysMock: vi.fn(),
    pullBackupItemsMock: vi.fn(),
}))

vi.mock('../../crypto', () => ({ deriveBackupKeys: deriveBackupKeysMock }))
vi.mock('../../credentials/keyStorage', () => ({
    persistBackupKeys: persistBackupKeysMock,
    deleteBackupKeys: deleteBackupKeysMock,
}))
vi.mock('../pullBackupItems', () => ({
    pullBackupItems: pullBackupItemsMock,
}))

import {
    CloudBackupRestoreError,
    restoreCloudBackup,
} from '../restoreCloudBackup'

const MNEMONIC = ['abandon', 'ability', 'able']
const SUMMARY = { imported: 1, skippedDuplicate: 0, failed: [] }

const importAccounts = vi.fn()

const params = () => ({
    mnemonic: MNEMONIC,
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    network: 'mainnet' as const,
    importAccounts,
})

const keys = (fill = 5) => ({
    backupId: 'did:pera:abc',
    encryptionKey: new Uint8Array(32).fill(fill),
    authPublicKey: new Uint8Array(32).fill(3),
    authSecretKey: new Uint8Array(64).fill(4),
})

const pull = {
    backupGlobalHash: 'hash',
    lastSeq: 10,
    accounts: [{ address: 'A', addressPayload: {}, secretsPayload: null }],
    skipped: [],
}

const expectCategory = async (
    promise: Promise<unknown>,
    category: string,
): Promise<void> => {
    await expect(promise).rejects.toMatchObject({
        name: 'CloudBackupRestoreError',
        category,
    })
}

describe('restoreCloudBackup', () => {
    beforeEach(() => {
        deriveBackupKeysMock.mockReset().mockResolvedValue(keys())
        persistBackupKeysMock.mockReset().mockResolvedValue(undefined)
        deleteBackupKeysMock.mockReset().mockResolvedValue(undefined)
        pullBackupItemsMock.mockReset().mockResolvedValue(pull)
        importAccounts.mockReset().mockResolvedValue(SUMMARY)
    })

    test('persists the keys, imports the pulled accounts and seeds the sync state', async () => {
        const result = await restoreCloudBackup(params())

        expect(persistBackupKeysMock).toHaveBeenCalledWith({
            encryptionKey: expect.any(Uint8Array),
            authSecretKey: expect.any(Uint8Array),
            mnemonic: MNEMONIC,
        })
        expect(importAccounts).toHaveBeenCalledWith(pull.accounts)
        expect(result.backupId).toBe('did:pera:abc')
        expect(result.summary).toBe(SUMMARY)
        expect(result.syncState).toMatchObject({
            backupId: 'did:pera:abc',
            lastKnownBackupHash: 'hash',
            lastSyncedSeq: 10,
            lastSyncResult: 'SUCCESS',
        })
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('persists the keys before pulling, so the signed request can read them', async () => {
        const order: string[] = []
        persistBackupKeysMock.mockImplementation(async () => {
            order.push('persist')
        })
        pullBackupItemsMock.mockImplementation(async () => {
            order.push('pull')
            return pull
        })

        await restoreCloudBackup(params())

        expect(order).toEqual(['persist', 'pull'])
    })

    test('categorizes a 404 as NOT_FOUND and rolls the keys back', async () => {
        pullBackupItemsMock.mockRejectedValue(
            new PeraNetworkError('client', { status: 404 }),
        )

        await expectCategory(restoreCloudBackup(params()), 'NOT_FOUND')

        expect(deleteBackupKeysMock).toHaveBeenCalledTimes(1)
    })

    test('categorizes a 401 as INVALID_CREDENTIALS', async () => {
        pullBackupItemsMock.mockRejectedValue(
            new PeraNetworkError('client', { status: 401 }),
        )

        await expectCategory(
            restoreCloudBackup(params()),
            'INVALID_CREDENTIALS',
        )
    })

    test('does not read a status off an untyped rejection', async () => {
        pullBackupItemsMock.mockRejectedValue({ status: 404 })

        await expectCategory(restoreCloudBackup(params()), 'UNKNOWN')
    })

    test('categorizes a failed derivation as INVALID_CREDENTIALS without touching storage', async () => {
        // What a truncated paste of the base64 encryption key actually does.
        deriveBackupKeysMock.mockRejectedValue(
            new Error('Invalid string. Length must be a multiple of 4'),
        )

        await expectCategory(
            restoreCloudBackup(params()),
            'INVALID_CREDENTIALS',
        )

        expect(persistBackupKeysMock).not.toHaveBeenCalled()
        expect(pullBackupItemsMock).not.toHaveBeenCalled()
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('reports the restore failure even if the rollback itself fails', async () => {
        pullBackupItemsMock.mockRejectedValue(
            new PeraNetworkError('client', { status: 404 }),
        )
        deleteBackupKeysMock.mockRejectedValue(new Error('keystore busy'))

        await expectCategory(restoreCloudBackup(params()), 'NOT_FOUND')

        expect(deleteBackupKeysMock).toHaveBeenCalledTimes(1)
    })

    test('zeroes the derived secrets on both the success and the failure path', async () => {
        const succeeded = keys()
        deriveBackupKeysMock.mockResolvedValue(succeeded)
        await restoreCloudBackup(params())
        expect(succeeded.encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(succeeded.authSecretKey.every(byte => byte === 0)).toBe(true)

        const failed = keys()
        deriveBackupKeysMock.mockResolvedValue(failed)
        pullBackupItemsMock.mockRejectedValue(new Error('network down'))
        await expect(restoreCloudBackup(params())).rejects.toBeInstanceOf(
            CloudBackupRestoreError,
        )
        expect(failed.encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(failed.authSecretKey.every(byte => byte === 0)).toBe(true)
    })
})
