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
import { renderHook } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { PeraNetworkError } from '@perawallet/wallet-core-shared'

const {
    deriveBackupKeysMock,
    persistBackupKeysMock,
    deleteBackupKeysMock,
    pullBackupItemsMock,
    getDerivedPublicKeyMock,
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
        getDerivedPublicKeyMock: vi.fn(),
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
}))
vi.mock('../pullBackupItems', () => ({
    pullBackupItems: pullBackupItemsMock,
}))
// Real `entropyChildIdOf`/`seedSchemeOf`/`SeedScheme`/`zeroBytes`, so the
// acceptance test below exercises the actual seed-lookup logic; only the
// KMS session (`useKMS`) and the secret read (`withSecret`, which needs a
// real keystore backend) are faked.
vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    useKMS: () => ({ getDerivedPublicKey: getDerivedPublicKeyMock }),
    withSecret: withSecretMock,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ keyValueStorage: { getItem: () => null } }),
    getKeystoreStore: () => ({ state: { keys: keystoreKeysMock() } }),
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

import {
    CloudBackupRestoreError,
    restoreCloudBackup,
} from '../restoreCloudBackup'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '@perawallet/wallet-core-passkeys'
import { useCloudBackupPasskeyImport } from '../../hooks/useCloudBackupPasskeyImport'
import { useResolveSeedEntropyForBackup } from '../../hooks/useResolveSeedEntropyForBackup'
import { encodeAlgorandAddress } from '@perawallet/wallet-core-blockchain'

const MNEMONIC = ['abandon', 'ability', 'able']
const SUMMARY = { imported: 1, skippedDuplicate: 0, failed: [] }

const CONTACT_SUMMARY = { imported: 1, failed: [] }
const PASSKEY_SUMMARY = { imported: 1, skipped: [], failed: [] }

const importAccounts = vi.fn()
const importContacts = vi.fn()
const importPasskeys = vi.fn()

const params = () => ({
    mnemonic: MNEMONIC,
    salt: 'c2FsdA==',
    deviceId: 'device-123',
    network: 'mainnet' as const,
    importAccounts,
    importContacts,
    importPasskeys,
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
    passkeys: [{ credentialId: 'cred-1', seedAddress: 'A' }],
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

describe('restoreCloudBackup: passkey acceptance', () => {
    // The whole point: this is the real derivation chain, not a stub, so a
    // credential that reproduces here is proof "created on device A,
    // authenticates on device B after restore" actually holds.
    const subtle = webcrypto.subtle as unknown as SubtleCrypto
    const ENTROPY = new Uint8Array(32).fill(9)
    const SEED_PUBKEY = new Uint8Array(32).fill(5)
    const SEED_ADDRESS = encodeAlgorandAddress(SEED_PUBKEY)

    const buildRestoredPasskeyPayload = async () => {
        const mainKey = await derivePasskeyMainKey(ENTROPY, subtle)
        const derived = await derivePasskeyCredential({
            mainKey,
            origin: 'webauthn.io',
            identity: 'alice',
        })
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
        getDerivedPublicKeyMock.mockReset().mockResolvedValue(SEED_PUBKEY)
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
        pullBackupItemsMock.mockResolvedValue({ ...pull, passkeys: [payload] })

        const { result } = renderHook(() =>
            useCloudBackupPasskeyImport(useResolveSeedEntropyForBackup()),
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
})
