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

const CONTACT_SUMMARY = { imported: 1, failed: [] }

const importAccounts = vi.fn()
const importContacts = vi.fn()

const params = () => ({
    mnemonic: MNEMONIC,
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    network: 'mainnet' as const,
    importAccounts,
    importContacts,
})

const keys = (fill = 5) => ({
    backupId: 'did:pera:abc',
    encryptionKey: new Uint8Array(32).fill(fill),
    authPublicKey: new Uint8Array(32).fill(3),
    authSecretKey: new Uint8Array(64).fill(4),
})

const manifestItem = (overrides = {}) => ({
    type: 'ACCOUNT',
    ver: 3,
    status: 'ACTIVE',
    hash: 'sha256:remote',
    lastSeq: 9,
    ...overrides,
})

const pull = {
    backupGlobalHash: 'hash',
    lastSeq: 10,
    manifestItems: {
        'accounts/A': manifestItem(),
        'secrets/A': manifestItem({ ver: 2, hash: 'sha256:secret' }),
    },
    accounts: [{ address: 'A', addressPayload: {}, secretsPayload: null }],
    contacts: [{ address: 'C', name: 'Alice', updatedAt: 5 }],
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
        importContacts.mockReset().mockResolvedValue(CONTACT_SUMMARY)
    })

    test('persists the keys, imports the pulled accounts and seeds the sync state', async () => {
        const result = await restoreCloudBackup(params())

        expect(persistBackupKeysMock).toHaveBeenCalledWith({
            encryptionKey: expect.any(Uint8Array),
            authSecretKey: expect.any(Uint8Array),
            mnemonic: MNEMONIC,
        })
        expect(importAccounts).toHaveBeenCalledWith(pull.accounts)
        expect(importContacts).toHaveBeenCalledWith(pull.contacts)
        expect(result.backupId).toBe('did:pera:abc')
        expect(result.summary).toBe(SUMMARY)
        expect(result.contactSummary).toBe(CONTACT_SUMMARY)
        expect(result.syncState).toMatchObject({
            backupId: 'did:pera:abc',
            lastKnownBackupHash: 'hash',
            lastSyncedSeq: 10,
            lastSyncResult: 'SUCCESS',
        })
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('derives under the argon2id config it was given, not the build defaults', async () => {
        const argon2id = {
            timeCost: 4,
            memoryCost: 128,
            parallelism: 2,
            outputLength: 32,
        }

        await restoreCloudBackup({ ...params(), argon2id })

        expect(deriveBackupKeysMock).toHaveBeenCalledWith(
            expect.objectContaining({ argon2id }),
        )
    })

    test('leaves the config unset when the caller has none', async () => {
        await restoreCloudBackup(params())

        expect(deriveBackupKeysMock).toHaveBeenCalledWith(
            expect.objectContaining({ argon2id: undefined }),
        )
    })

    test('adopts the manifest versions, so the first push after a restore is not refused', async () => {
        const { syncState } = await restoreCloudBackup(params())

        // Version 0 would mean "the server has nothing here"; the server has
        // these at 3 and 2, refuses the write, and no delta ever follows to
        // correct it.
        expect(syncState.items['accounts/A']).toMatchObject({
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            status: 'ACTIVE',
            lastRemoteHash: 'sha256:remote',
        })
        expect(syncState.items['secrets/A']).toMatchObject({
            knownVer: 2,
            baseVer: 2,
        })
    })

    test('tracks keys the restore never imported, tombstones included', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                'accounts/GONE': manifestItem({ ver: 7, status: 'IGNORED' }),
            },
            // Deleted and unreadable items are filtered out of the import.
            accounts: [],
        })

        const { syncState } = await restoreCloudBackup(params())

        expect(syncState.items['accounts/GONE']).toMatchObject({
            knownVer: 7,
            baseVer: 7,
            status: 'IGNORED',
        })
    })

    test('keeps a restore whose accounts landed when the contact import throws', async () => {
        importContacts.mockRejectedValue(new Error('store unavailable'))

        const result = await restoreCloudBackup(params())

        expect(result.summary).toBe(SUMMARY)
        expect(result.contactSummary).toEqual({ imported: 0, failed: [] })
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
