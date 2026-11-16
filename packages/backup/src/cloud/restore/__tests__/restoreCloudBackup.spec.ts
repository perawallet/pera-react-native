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

// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

const {
    deriveBackupKeysMock,
    persistBackupKeysMock,
    deleteBackupKeysMock,
    pullBackupItemsMock,
    previewBackupAccountsMock,
    keystoreKeysMock,
    secretBytesById,
    withSecretMock,
    writeNativePasskeyEntryMock,
    nativePasskeyEntryExistsMock,
} = vi.hoisted(() => {
    const secretBytesById = new Map<string, Uint8Array>()
    return {
        deriveBackupKeysMock: vi.fn(),
        persistBackupKeysMock: vi.fn(),
        deleteBackupKeysMock: vi.fn(),
        pullBackupItemsMock: vi.fn(),
        previewBackupAccountsMock: vi.fn().mockReturnValue([]),
        keystoreKeysMock: vi.fn().mockReturnValue([]),
        secretBytesById,
        // Mirrors `withSecret`'s real contract: hands the handler a live
        // buffer, then zeroes that same buffer once the handler returns.
        withSecretMock: vi.fn(
            async (id: string, handler: (bytes: Uint8Array) => unknown) => {
                const bytes = secretBytesById.get(id)
                if (!bytes) return null
                try {
                    return await handler(bytes)
                } finally {
                    bytes.fill(0)
                }
            },
        ),
        writeNativePasskeyEntryMock: vi.fn(),
        nativePasskeyEntryExistsMock: vi.fn().mockReturnValue(false),
    }
})

vi.mock('../../crypto', () => ({ deriveBackupKeys: deriveBackupKeysMock }))
vi.mock('../../credentials/keyStorage', () => ({
    persistBackupKeys: persistBackupKeysMock,
    deleteBackupKeys: deleteBackupKeysMock,
    withBackupEncryptionKey: (handler: (bytes: Uint8Array) => unknown) =>
        handler(new Uint8Array(32).fill(5)),
}))
// The mocked fetch hands back the decrypted pull itself, so collecting it is
// the identity; `pullBackupItems.spec` covers the real decryption.
vi.mock('../pullBackupItems', () => ({
    fetchBackupItems: pullBackupItemsMock,
    collectBackupItems: (fetched: unknown) => fetched,
    previewBackupAccounts: previewBackupAccountsMock,
}))
// Real `entropyChildIdOf`/`seedSchemeOf`/`SeedScheme`/`zeroBytes`, so the
// acceptance test below exercises the actual seed-lookup logic; only the
// secret read (`withSecret`, which needs a real keystore backend) is faked.
vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    withSecret: withSecretMock,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        keyValueStorage: { getItem: () => null },
        passkeyAutofill: { refreshCredentialIdentities: async () => {} },
        deviceInfo: { getDevicePlatform: () => 'ios' },
        chains: {
            has: () => true,
            list: () => [{ id: 'algorand' }],
            capabilities: () => ({ cloudBackup: true }),
        },
    }),
    getKeystoreStore: () => ({ state: { keys: keystoreKeysMock() } }),
    // The import derives with `derivePasskeyMainKey`'s default `subtle`.
    keystoreSubtle: webcrypto.subtle,
}))
// Real `derivePasskeyMainKey`/`derivePasskeyCredential`/`passkeyBackupInputs`
// (proving reproduction is the entire point of this test); only the native
// write boundary is faked.
vi.mock('@perawallet/wallet-core-passkeys', async importOriginal => ({
    ...(await importOriginal<object>()),
    writeNativePasskeyEntry: (...args: unknown[]) =>
        writeNativePasskeyEntryMock(...args),
    nativePasskeyEntryExists: (...args: unknown[]) =>
        nativePasskeyEntryExistsMock(...args),
}))

import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    accountItemKey,
    contactItemKey,
    secretsItemKey,
    settingsItemKey,
    SETTINGS_ITEM_ID,
    BackupAccountType,
    chainBackupKind,
} from '../../models'
import {
    CloudBackupRestoreError,
    completeCloudBackupRestore,
    discardPreparedCloudBackupRestore,
    prepareCloudBackupRestore,
    restoreCloudBackup,
} from '../restoreCloudBackup'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '@perawallet/wallet-core-passkeys'
import { useCloudBackupPasskeyImport } from '../../hooks/useCloudBackupPasskeyImport'
import { useResolveSeedEntropyForBackup } from '../../hooks/useResolveSeedEntropyForBackup'

const HD_ACCOUNT_KIND = chainBackupKind('hdWallet')
import {
    accountsChainAdapters,
    type AccountsChainAdapter,
} from '@perawallet/wallet-core-accounts'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const ACCOUNT_KEY = accountItemKey(hashAddress('A'))
const SECRETS_KEY = secretsItemKey(hashAddress('A'))
const CONTACT_KEY = contactItemKey(hashAddress('C'))
const UNREADABLE_KEY = accountItemKey(hashAddress('GONE'))
const SETTINGS_KEY = settingsItemKey(hashAddress(SETTINGS_ITEM_ID))

const MNEMONIC = ['abandon', 'ability', 'able']
const SUMMARY = { imported: 1, skippedDuplicate: 0, failed: [] }

const CONTACT_SUMMARY = { imported: 1, failed: [] }
const PASSKEY_SUMMARY = { imported: 1, skipped: [], failed: [] }

const importAccounts = vi.fn()
const importContacts = vi.fn()
const importPasskeys = vi.fn()
const importSettings = vi.fn()

const params = () => ({
    mnemonic: MNEMONIC,
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    importAccounts,
    importContacts,
    importPasskeys,
    importSettings,
})

const keys = (fill = 5) => ({
    backupId: 'did:pera:abc',
    encryptionKey: new Uint8Array(32).fill(fill),
    authPublicKey: new Uint8Array(32).fill(3),
    authSecretKey: new Uint8Array(64).fill(4),
    itemKey: new Uint8Array(32).fill(6),
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
        [ACCOUNT_KEY]: manifestItem(),
        [SECRETS_KEY]: manifestItem({ ver: 2, hash: 'sha256:secret' }),
        [CONTACT_KEY]: manifestItem({ type: 'CONTACT', ver: 1 }),
    },
    trackedByKey: {
        [ACCOUNT_KEY]: {
            address: 'A',
            accountType: HD_ACCOUNT_KIND,
        },
        [SECRETS_KEY]: { address: 'A', accountType: BackupAccountType.hdSeed },
        [CONTACT_KEY]: { address: 'C', accountType: null },
    },
    accounts: [
        {
            address: 'A',
            group: 'A',
            addressPayload: {
                type: HD_ACCOUNT_KIND,
                address: 'A',
            },
            secretsPayload: { type: BackupAccountType.hdSeed, address: 'A' },
        },
    ],
    contacts: [{ address: 'C', name: 'Alice', updatedAt: 5 }],
    passkeys: [
        { payload: { credentialId: 'cred-1', seedAddress: 'A' }, secret: null },
    ],
    settings: null,
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
        importPasskeys.mockReset().mockResolvedValue(PASSKEY_SUMMARY)
        importSettings.mockReset()
    })

    test('persists the keys, imports the pulled accounts and seeds the sync state', async () => {
        const result = await restoreCloudBackup(params())

        expect(persistBackupKeysMock).toHaveBeenCalledWith({
            encryptionKey: expect.any(Uint8Array),
            authSecretKey: expect.any(Uint8Array),
            itemKey: expect.any(Uint8Array),
            mnemonic: MNEMONIC,
        })
        expect(importAccounts).toHaveBeenCalledWith(
            pull.accounts,
            expect.any(Function),
        )
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

    test('seeds the chains this build can read, so the first sync does not re-read what it skipped', async () => {
        const result = await restoreCloudBackup(params())

        expect(result.syncState.readableChains).toEqual([])

        accountsChainAdapters.register({
            chainId: 'algorand',
        } as unknown as AccountsChainAdapter)
        const withAdapter = await restoreCloudBackup(params())

        expect(withAdapter.syncState.readableChains).toEqual(['algorand'])
    })

    test('reports each phase in order, with the account import counted', async () => {
        importAccounts.mockImplementation(
            async (
                _accounts: unknown,
                onProgress: (done: number, total: number) => void,
            ) => {
                onProgress(0, 2)
                onProgress(1, 2)
                onProgress(2, 2)
                return SUMMARY
            },
        )
        const onProgress = vi.fn()

        await restoreCloudBackup({ ...params(), onProgress })

        expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
            { phase: 'unlocking' },
            { phase: 'downloading' },
            { phase: 'importing', done: 0, total: 2 },
            { phase: 'importing', done: 1, total: 2 },
            { phase: 'importing', done: 2, total: 2 },
            { phase: 'finishing' },
        ])
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
        expect(syncState.items[ACCOUNT_KEY]).toMatchObject({
            knownVer: 3,
            baseVer: 3,
            isDirty: false,
            status: 'ACTIVE',
            lastRemoteHash: 'sha256:remote',
        })
        expect(syncState.items[SECRETS_KEY]).toMatchObject({
            knownVer: 2,
            baseVer: 2,
        })
    })

    test('tracks keys the restore never imported, tombstones included', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                [UNREADABLE_KEY]: manifestItem({ ver: 7, status: 'IGNORED' }),
            },
            // Deleted and unreadable items are filtered out of the import.
            accounts: [],
        })

        const { syncState } = await restoreCloudBackup(params())

        expect(syncState.items[UNREADABLE_KEY]).toMatchObject({
            knownVer: 7,
            baseVer: 7,
            status: 'IGNORED',
        })
    })

    // An item seeded without an address is invisible to every review list
    // until some later delta decrypts it.
    test('stamps each read item with the address the pull decrypted', async () => {
        const { syncState } = await restoreCloudBackup(params())

        expect(syncState.items[ACCOUNT_KEY]).toMatchObject({
            address: 'A',
            accountType: HD_ACCOUNT_KIND,
        })
        expect(syncState.items[SECRETS_KEY]).toMatchObject({
            address: 'A',
            accountType: BackupAccountType.hdSeed,
        })
        expect(syncState.items[CONTACT_KEY]).toMatchObject({
            address: 'C',
            accountType: null,
        })
    })

    test('counts an account with failed chains once, not once per chain', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            accounts: [
                { ...pull.accounts[0], address: 'A', group: 'S/0/0' },
                { ...pull.accounts[0], address: '0xa', group: 'S/0/0' },
                { ...pull.accounts[0], address: 'B', group: 'B' },
            ],
        })
        importAccounts.mockResolvedValue({
            ...SUMMARY,
            failed: [
                { address: 'A', reason: 'x' },
                { address: '0xa', reason: 'x' },
            ],
        })

        const { incompleteAccountCount } = await restoreCloudBackup(params())

        expect(incompleteAccountCount).toBe(1)
    })

    test('counts the accounts only a newer app can restore', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            skipped: [
                { key: 'account-records/a', reason: 'newer' },
                { key: 'account-records/b', reason: 'newer' },
                { key: ACCOUNT_KEY, reason: 'parse' },
            ],
        })

        const { newerAccountCount } = await restoreCloudBackup(params())

        expect(newerAccountCount).toBe(2)
    })

    test('leaves a newer contact record out of the count of accounts', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            skipped: [
                { key: 'contact-records/a', reason: 'newer' },
                { key: 'account-records/b', reason: 'newer' },
            ],
        })

        const { newerAccountCount } = await restoreCloudBackup(params())

        expect(newerAccountCount).toBe(1)
    })

    test('marks the items of an account that failed to import for the first syncs to retry', async () => {
        importAccounts.mockResolvedValue({
            ...SUMMARY,
            // A contact can share an account's address; only account items retry.
            failed: [
                { address: 'A', reason: 'keystore refused' },
                { address: 'C', reason: 'keystore refused' },
            ],
        })

        const { syncState } = await restoreCloudBackup(params())

        expect(syncState.items[ACCOUNT_KEY]?.importFailures).toBe(1)
        expect(syncState.items[SECRETS_KEY]?.importFailures).toBe(1)
        expect(syncState.items[CONTACT_KEY]?.importFailures).toBeUndefined()
    })

    test('leaves an item the pull could not read without an address', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                [UNREADABLE_KEY]: manifestItem({ ver: 7 }),
            },
        })

        const { syncState } = await restoreCloudBackup(params())

        expect(syncState.items[UNREADABLE_KEY].address ?? null).toBeNull()
    })

    // A newer client may add item kinds; their keys are hashed, so they must
    // not be mistaken for the legacy layout the restore refuses.
    test('restores a backup holding an item kind it does not know and keeps tracking it', async () => {
        const unknownKey = `fixture-kind/${hashAddress('FIXADDR')}`
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                [unknownKey]: manifestItem({ ver: 4 }),
            },
        })

        const { syncState } = await restoreCloudBackup(params())

        expect(importAccounts).toHaveBeenCalledWith(
            pull.accounts,
            expect.any(Function),
        )
        expect(syncState.items[unknownKey]).toMatchObject({
            knownVer: 4,
            status: 'ACTIVE',
        })
        expect(syncState.items[unknownKey].address ?? null).toBeNull()
    })

    test('keeps a restore whose accounts landed when the contact import throws', async () => {
        importContacts.mockRejectedValue(new Error('store unavailable'))

        const result = await restoreCloudBackup(params())

        expect(result.summary).toBe(SUMMARY)
        expect(result.contactSummary).toEqual({ imported: 0, failed: [] })
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('imports passkeys after accounts and contacts, so their owning seed is already in the keystore', async () => {
        const order: string[] = []
        importAccounts.mockImplementation(async () => {
            order.push('accounts')
            return SUMMARY
        })
        importContacts.mockImplementation(async () => {
            order.push('contacts')
            return CONTACT_SUMMARY
        })
        importPasskeys.mockImplementation(async passkeys => {
            order.push('passkeys')
            expect(passkeys).toEqual(pull.passkeys)
            return PASSKEY_SUMMARY
        })

        await restoreCloudBackup(params())

        expect(order).toEqual(['accounts', 'contacts', 'passkeys'])
    })

    test('keeps a restore whose accounts landed when the passkey import throws', async () => {
        importPasskeys.mockRejectedValue(new Error('keystore busy'))

        const result = await restoreCloudBackup(params())

        expect(result.summary).toBe(SUMMARY)
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('does not call the passkey importer when the backup holds none', async () => {
        pullBackupItemsMock.mockResolvedValue({ ...pull, passkeys: [] })

        await restoreCloudBackup(params())

        expect(importPasskeys).not.toHaveBeenCalled()
    })

    test('adopts the backup settings and seeds them unobserved for the first sync', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                [SETTINGS_KEY]: manifestItem({ type: 'SETTINGS', ver: 4 }),
            },
            settings: {
                key: SETTINGS_KEY,
                payload: { language: { value: 'de', updatedAt: 50 } },
            },
        })

        const result = await restoreCloudBackup(params())

        expect(importSettings).toHaveBeenCalledWith({ language: 'de' })
        expect(result.syncState.items[SETTINGS_KEY]).toMatchObject({
            knownVer: 4,
            settingsFields: {
                language: { value: 'de', updatedAt: 50, observed: null },
            },
        })
    })

    test('keeps a restore whose accounts landed when the settings import throws', async () => {
        importSettings.mockImplementation(() => {
            throw new Error('store unavailable')
        })
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            settings: {
                key: SETTINGS_KEY,
                payload: { language: { value: 'de', updatedAt: 50 } },
            },
        })

        const result = await restoreCloudBackup(params())

        expect(result.summary).toBe(SUMMARY)
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('does not call the settings importer when the backup holds none', async () => {
        await restoreCloudBackup(params())

        expect(importSettings).not.toHaveBeenCalled()
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

    test('refuses a backup still keyed by plaintext address, before importing', async () => {
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            manifestItems: {
                ...pull.manifestItems,
                'accounts/A': manifestItem(),
            },
        })

        await expectCategory(restoreCloudBackup(params()), 'UNKNOWN')

        expect(importAccounts).not.toHaveBeenCalled()
        expect(importContacts).not.toHaveBeenCalled()
        expect(deleteBackupKeysMock).toHaveBeenCalledTimes(1)
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
        expect(succeeded.itemKey.every(byte => byte === 0)).toBe(true)

        const failed = keys()
        deriveBackupKeysMock.mockResolvedValue(failed)
        pullBackupItemsMock.mockRejectedValue(new Error('network down'))
        await expect(restoreCloudBackup(params())).rejects.toBeInstanceOf(
            CloudBackupRestoreError,
        )
        expect(failed.encryptionKey.every(byte => byte === 0)).toBe(true)
        expect(failed.authSecretKey.every(byte => byte === 0)).toBe(true)
        expect(failed.itemKey.every(byte => byte === 0)).toBe(true)
    })
})

describe('prepareCloudBackupRestore and completeCloudBackupRestore', () => {
    const B_ACCOUNT_KEY = accountItemKey(hashAddress('B'))
    const twoAccounts = {
        ...pull,
        manifestItems: {
            ...pull.manifestItems,
            [B_ACCOUNT_KEY]: manifestItem(),
        },
        trackedByKey: {
            ...pull.trackedByKey,
            [B_ACCOUNT_KEY]: { address: 'B', accountType: 'watch' },
        },
        accounts: [
            ...pull.accounts,
            {
                address: 'B',
                group: 'B',
                addressPayload: { type: 'watch', address: 'B' },
                secretsPayload: null,
            },
        ],
    }
    const imports = () => {
        const { mnemonic: _, salt: __, deviceId: ___, ...rest } = params()
        return rest
    }

    beforeEach(() => {
        deriveBackupKeysMock.mockReset().mockImplementation(async () => keys())
        persistBackupKeysMock.mockReset().mockResolvedValue(undefined)
        deleteBackupKeysMock.mockReset().mockResolvedValue(undefined)
        pullBackupItemsMock.mockReset().mockResolvedValue(twoAccounts)
        previewBackupAccountsMock.mockReset().mockReturnValue([
            { group: 'A', name: 'Alpha', chains: [{ address: 'A' }] },
            { group: 'B', name: null, chains: [{ address: 'B' }] },
        ])
        importAccounts.mockReset().mockResolvedValue(SUMMARY)
        importContacts.mockReset().mockResolvedValue(CONTACT_SUMMARY)
        importPasskeys.mockReset().mockResolvedValue(PASSKEY_SUMMARY)
        importSettings.mockReset()
    })

    test('prepares the account choice without importing anything', async () => {
        const { mnemonic, salt, deviceId } = params()

        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })

        expect(prepared.backupId).toBe('did:pera:abc')
        expect(prepared.deviceId).toBe('device-123')
        expect(prepared.accounts.map(({ group }) => group)).toEqual(['A', 'B'])
        expect(importAccounts).not.toHaveBeenCalled()
        expect(importContacts).not.toHaveBeenCalled()
        expect(deleteBackupKeysMock).not.toHaveBeenCalled()
    })

    test('imports only the chosen accounts and holds the rest in the backup', async () => {
        const { mnemonic, salt, deviceId } = params()
        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })

        const result = await completeCloudBackupRestore({
            prepared,
            selection: new Set(['B']),
            ...imports(),
        })

        expect(importAccounts).toHaveBeenCalledWith(
            [twoAccounts.accounts[1]],
            expect.any(Function),
        )
        expect(result.syncState.items[ACCOUNT_KEY]?.pendingImport).toBe(true)
        expect(result.syncState.items[SECRETS_KEY]?.pendingImport).toBe(true)
        expect(
            result.syncState.items[B_ACCOUNT_KEY]?.pendingImport,
        ).toBeUndefined()
        expect(importContacts).toHaveBeenCalledWith(twoAccounts.contacts)
    })

    test('does not hold an unchosen account this device already has', async () => {
        const { mnemonic, salt, deviceId } = params()
        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })

        const result = await completeCloudBackupRestore({
            prepared,
            selection: new Set(['B']),
            isOnDevice: address => address === 'A',
            ...imports(),
        })

        expect(result.syncState.items[ACCOUNT_KEY]?.pendingImport).toBe(
            undefined,
        )
        expect(result.syncState.items[SECRETS_KEY]?.pendingImport).toBe(
            undefined,
        )
    })

    test('brings the seed of a chosen HD account along when its entry was left out', async () => {
        const seedSecret = {
            type: BackupAccountType.hdSeed,
            address: 'SEED',
            seed: 'ff',
            entropy: 'ee',
        }
        const hdEntry = (address: string, keyIndex: number) => ({
            type: HD_ACCOUNT_KIND,
            address,
            seedFirstDerivedAddress: 'SEED',
            account: 0,
            keyIndex,
        })
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            accounts: [
                {
                    address: 'SEED',
                    group: 'SEED/0/0',
                    addressPayload: hdEntry('SEED', 0),
                    secretsPayload: seedSecret,
                },
                {
                    address: 'SECOND',
                    group: 'SEED/0/1',
                    addressPayload: hdEntry('SECOND', 1),
                    secretsPayload: null,
                },
            ],
        })
        const { mnemonic, salt, deviceId } = params()
        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })

        await completeCloudBackupRestore({
            prepared,
            selection: new Set(['SEED/0/1']),
            ...imports(),
        })

        expect(importAccounts.mock.calls[0]?.[0]).toEqual([
            expect.objectContaining({ group: 'SEED/0/1' }),
            {
                address: 'SEED',
                group: 'SEED',
                addressPayload: {
                    type: BackupAccountType.hdSeed,
                    address: 'SEED',
                },
                secretsPayload: seedSecret,
            },
        ])
    })

    test('imports every account and holds none for "all"', async () => {
        const { mnemonic, salt, deviceId } = params()
        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })

        const result = await completeCloudBackupRestore({
            prepared,
            selection: 'all',
            ...imports(),
        })

        expect(importAccounts).toHaveBeenCalledWith(
            twoAccounts.accounts,
            expect.any(Function),
        )
        expect(
            Object.values(result.syncState.items).some(
                item => item.pendingImport === true,
            ),
        ).toBe(false)
    })

    test('removes the stored keys when the import fails', async () => {
        const { mnemonic, salt, deviceId } = params()
        const prepared = await prepareCloudBackupRestore({
            mnemonic,
            salt,
            deviceId,
        })
        importAccounts.mockRejectedValue(new Error('kms down'))

        await expect(
            completeCloudBackupRestore({
                prepared,
                selection: 'all',
                ...imports(),
            }),
        ).rejects.toBeInstanceOf(CloudBackupRestoreError)
        expect(deleteBackupKeysMock).toHaveBeenCalled()
    })

    test('removes the stored keys when the user backs out before choosing', async () => {
        await discardPreparedCloudBackupRestore()

        expect(deleteBackupKeysMock).toHaveBeenCalled()
    })
})

describe('restoreCloudBackup: passkey acceptance', () => {
    // The whole point: this is the real derivation chain, not a stub, so a
    // credential that reproduces here is proof "created on device A,
    // authenticates on device B after restore" actually holds.
    const subtle = webcrypto.subtle as unknown as SubtleCrypto
    const ENTROPY = new Uint8Array(32).fill(9)
    const SEED_ADDRESS =
        'AUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUC7CN5SGQ'

    const derivePasskey = async () =>
        derivePasskeyCredential({
            mainKey: await derivePasskeyMainKey(ENTROPY, subtle),
            origin: 'webauthn.io',
            identity: 'alice',
        })

    const buildRestoredPasskeyPayload = async () => {
        const derived = await derivePasskey()
        return {
            credentialId: derived.credentialId,
            origin: 'webauthn.io',
            identity: 'alice',
            counter: 0,
            publicKeySpkiDer: Buffer.from(derived.publicKeySpkiDer).toString(
                'base64',
            ),
            seedAddress: SEED_ADDRESS,
            createdAt: 1,
        }
    }

    beforeEach(() => {
        deriveBackupKeysMock.mockReset().mockResolvedValue(keys())
        persistBackupKeysMock.mockReset().mockResolvedValue(undefined)
        deleteBackupKeysMock.mockReset().mockResolvedValue(undefined)
        importAccounts.mockReset().mockResolvedValue(SUMMARY)
        importContacts.mockReset().mockResolvedValue(CONTACT_SUMMARY)

        // A single on-device bip39 seed ("device B") whose first-derived
        // address matches the payload's `seedAddress`.
        backupChainAdapters.reset()
        backupChainAdapters.register(
            fakeBackupAdapter({ seedReference: async () => SEED_ADDRESS }),
        )
        keystoreKeysMock.mockReturnValue([
            {
                id: 'seed-b',
                type: 'hd-root-key',
                metadata: { scheme: 'bip39' },
            },
            {
                id: 'entropy-b',
                type: 'secret-key',
                metadata: { parentKeyId: 'seed-b', entropyKey: true },
            },
        ])
        secretBytesById.clear()
        secretBytesById.set('entropy-b', new Uint8Array(ENTROPY))

        writeNativePasskeyEntryMock.mockReset()
        nativePasskeyEntryExistsMock.mockReset().mockReturnValue(false)
    })

    test('a passkey created on device A authenticates on device B after restore', async () => {
        const payload = await buildRestoredPasskeyPayload()
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            passkeys: [{ payload, secret: null }],
        })

        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(
                'algorand',
                useResolveSeedEntropyForBackup('algorand'),
            ),
        )

        await restoreCloudBackup({
            ...params(),
            importPasskeys: result.current.importPasskeys,
        })

        // Not skipped (seed-missing / pubkey-mismatch / already-present) and
        // not silently dropped: the native record was actually written.
        expect(writeNativePasskeyEntryMock).toHaveBeenCalledTimes(1)
        expect(writeNativePasskeyEntryMock).toHaveBeenCalledWith(
            expect.objectContaining({ credentialId: payload.credentialId }),
        )
    })

    test('a passkey whose wallet device B never holds still restores from its backed-up key', async () => {
        const derived = await derivePasskey()
        const payload = {
            credentialId: derived.credentialId,
            origin: 'webauthn.io',
            publicKeySpkiDer: Buffer.from(derived.publicKeySpkiDer).toString(
                'base64',
            ),
            createdAt: 1,
        }
        keystoreKeysMock.mockReturnValue([])
        pullBackupItemsMock.mockResolvedValue({
            ...pull,
            passkeys: [
                {
                    payload,
                    secret: {
                        credentialId: derived.credentialId,
                        privateKey: Buffer.from(derived.privateKey).toString(
                            'base64',
                        ),
                    },
                },
            ],
        })

        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(
                'algorand',
                useResolveSeedEntropyForBackup('algorand'),
            ),
        )

        await restoreCloudBackup({
            ...params(),
            importPasskeys: result.current.importPasskeys,
        })

        expect(writeNativePasskeyEntryMock).toHaveBeenCalledWith(
            expect.objectContaining({ credentialId: derived.credentialId }),
        )
    })
})
