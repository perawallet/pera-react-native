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

import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchManifest = vi.fn()
const fetchDelta = vi.fn()
const readItems = vi.fn()
const batchUpsertItems = vi.fn()
const deleteItem = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchManifest: (...a: unknown[]) => fetchManifest(...a),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
    readItems: (...a: unknown[]) => readItems(...a),
    batchUpsertItems: (...a: unknown[]) => batchUpsertItems(...a),
    deleteItem: (...a: unknown[]) => deleteItem(...a),
}))

import { type WalletAccount } from '@perawallet/wallet-core-accounts'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { logger, PeraNetworkError } from '@perawallet/wallet-core-shared'
import { FromSeqTooOldError, UpsertResult } from '../../api'
import {
    decryptItemPayload,
    encryptItemPayload,
} from '../../crypto/itemPayload'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    accountRecordItemKey,
    contactItemKey,
    contactRecordItemKey,
    createEmptySyncState,
    passkeyItemKey,
    passkeySecretsItemKey,
    settingsItemKey,
    SETTINGS_ITEM_ID,
    type SyncState,
} from '../../models'
import { reconcileSettings } from '../reconcileSettings'
import { buildAccountRecord } from '../serializeAccountItems'
import { serializeAccountForBackup } from '../serializeAccountForBackup'
import { itemContentHash } from '../itemContentHash'
import { MAX_IMPORT_ATTEMPTS } from '../importRetry'
import { syncBackup } from '../syncBackup'
import { BackupSyncAbortedError } from '../types'
import { TEST_SETTINGS } from './testSettings'
import { registerFakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import {
    registerAlgorandAccountsAdapter,
    registerEthereumAccountsAdapter,
    registerEthereumBackupChain,
} from '../../../__tests__/backupChainFixtures'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const recordKey = (address: string) =>
    accountRecordItemKey(hashAddress(address))
const contactKey = (address: string) => contactItemKey(hashAddress(address))
const contactRecordKey = (id: string) => contactRecordItemKey(hashAddress(id))
const settingsKey = settingsItemKey(hashAddress(SETTINGS_ITEM_ID))

/** Settings the server already holds, so they add no push of their own. */
const withSyncedSettings = (state: SyncState): SyncState => {
    const next = reconcileSettings(state, settingsKey, TEST_SETTINGS, 1)
    next.items[settingsKey] = {
        ...next.items[settingsKey],
        isDirty: false,
        knownVer: 1,
        baseVer: 1,
        lastRemoteHash: 's',
    }
    // Algorand is always readable here, so a state that predates the check
    // would replay every record on its first sync.
    next.readableChains ??= ['algorand']
    return next
}

const encryptionKey = new Uint8Array(32).fill(7)
const watch: WalletAccount = {
    id: '1',
    custody: { kind: 'watch' },
    name: 'Watcher',
    chains: { algorand: { address: 'W' } },
}
// Built when asked: the chain and adapter registries are filled per test.
const watchRecordHash = () =>
    itemContentHash(
        recordKey('W'),
        buildAccountRecord(watch, { updatedAt: 1 }) as Record<string, unknown>,
    )
const serialize = (a: WalletAccount) =>
    serializeAccountForBackup(a, {
        chainId: 'algorand',
        updatedAt: 1,
        hashAddress,
    })

// The scope chain counts as backed up only with its accounts adapter.
registerAlgorandAccountsAdapter()

const deps = () => ({
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey,
    hashAddress,
    listAccounts: () => [watch],
    listContacts: () => [],
    isAborted: () => false,
    serializeAccount: serialize,
    importAccounts: vi.fn(async () => ({
        imported: 0,
        skippedDuplicate: 0,
        failed: [],
    })),
    importContacts: vi.fn(async () => ({ imported: 0, failed: [] })),
    getSettings: () => TEST_SETTINGS,
    importSettings: vi.fn(),
    listPasskeys: async () => [],
    importPasskeys: async () => ({ imported: 0, skipped: [], failed: [] }),
})

describe('syncBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        registerFakeBackupAdapter()
    })

    it('short-circuits to UpToDate when remote hash matches and nothing is dirty', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 10,
            items: {},
        })
        const state = createEmptySyncState('b')
        state.lastKnownBackupHash = 'g'
        state.items[recordKey('W')] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: watchRecordHash(),
            localUpdatedAt: 1,
            address: 'W',
        }
        const next = await syncBackup(deps(), withSyncedSettings(state))
        expect(fetchDelta).not.toHaveBeenCalled()
        expect(next.lastSyncResult).toBe('SUCCESS')
    })

    // Retention pruned past this device's cursor. The manifest is the only
    // description of the backup left, so the sync has to converge on it instead
    // of failing here forever.
    it('rebuilds from the manifest when the cursor has been pruned', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 100,
            items: {
                [recordKey('W')]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'r',
                    lastSeq: 97,
                },
                [settingsKey]: {
                    type: BackupItemType.SETTINGS,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 's',
                    lastSeq: 98,
                },
            },
        })
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))
        const state = createEmptySyncState('b')
        state.lastSyncedSeq = 3
        state.lastKnownBackupHash = 'stale'
        state.items[recordKey('W')] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: watchRecordHash(),
            localUpdatedAt: 1,
            address: 'W',
        }

        const next = await syncBackup(deps(), withSyncedSettings(state))

        expect(next.lastSyncResult).toBe('SUCCESS')
        expect(next.lastSyncedSeq).toBe(100)
        expect(next.lastKnownBackupHash).toBe('g')
        expect(readItems).not.toHaveBeenCalled()
        expect(batchUpsertItems).not.toHaveBeenCalled()
    })

    it('pulls deltas and pushes the new local account on a first sync', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g2',
            lastSeq: 0,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: recordKey('W'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 1,
                },
            ],
        })
        const next = await syncBackup(deps(), createEmptySyncState('b'))
        expect(batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.items[recordKey('W')]).toMatchObject({
            isDirty: false,
            knownVer: 1,
        })
        expect(next.lastKnownBackupHash).toBe('g2')
        expect(next.lastSyncResult).toBe('SUCCESS')
    })

    it('pushes local items when the backup has no manifest yet', async () => {
        fetchManifest.mockRejectedValue(
            new PeraNetworkError('client', { status: 404 }),
        )
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: recordKey('W'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 1,
                },
            ],
        })

        const warn = vi.spyOn(logger, 'warn')

        const next = await syncBackup(deps(), createEmptySyncState('b'))

        expect(batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.lastKnownBackupHash).toBeNull()
        expect(next.lastSyncedSeq).toBe(1)
        expect(next.lastSyncResult).toBe('SUCCESS')
        // Reporting SUCCESS on a missing manifest is only correct once; a 404
        // that keeps repeating disables the short-circuit and must be visible.
        expect(warn).toHaveBeenCalledWith(
            'syncBackup: no manifest, treating backup as empty',
        )
    })

    it('treats an un-normalized 404 as an empty backup too', async () => {
        fetchManifest.mockRejectedValue({ response: { status: 404 } })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({ results: [] })

        const next = await syncBackup(deps(), createEmptySyncState('b'))

        expect(next.lastSyncResult).toBe('SUCCESS')
    })

    it('records FAILED when the manifest fetch throws', async () => {
        fetchManifest.mockRejectedValue(new Error('network'))
        await expect(
            syncBackup(deps(), createEmptySyncState('b')),
        ).rejects.toThrow('network')
    })

    it('does NOT delete a synced account when its serialization fails', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g3',
            lastSeq: 5,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        const state = createEmptySyncState('b')
        state.readableChains = ['algorand']
        state.items[recordKey('W')] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'previously-synced',
            localUpdatedAt: null,
            address: 'W',
        }

        const next = await syncBackup(
            { ...deps(), serializeAccount: async () => null },
            state,
        )

        expect(deleteItem).not.toHaveBeenCalled()
        expect(next.items[recordKey('W')].pendingDelete).toBeUndefined()
    })

    it('refuses to sync a backup still keyed by plaintext address', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g4',
            lastSeq: 4,
            items: {
                'accounts/W': {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'r',
                    lastSeq: 4,
                },
            },
        })
        fetchDelta.mockResolvedValue([])

        const warn = vi.spyOn(logger, 'warn')

        const next = await syncBackup(deps(), createEmptySyncState('b'))

        expect(next.lastSyncResult).toBe('FAILED')
        expect(batchUpsertItems).not.toHaveBeenCalled()
        expect(deleteItem).not.toHaveBeenCalled()
        expect(readItems).not.toHaveBeenCalled()
        // Keeping the reconciled state would leave the local accounts tracked
        // as pending work forever, disabling the manifest short-circuit.
        expect(next.items).toEqual({})
        expect(warn).toHaveBeenCalledWith(
            'syncBackup: backup uses legacy address keys, refusing to sync',
            { legacyKeyCount: 1 },
        )
    })

    it('still syncs a manifest whose keys are all hashed', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g5',
            lastSeq: 1,
            items: {
                [recordKey('W')]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'r',
                    lastSeq: 1,
                },
            },
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: recordKey('W'),
                    result: UpsertResult.OK,
                    new_ver: 2,
                    seq: 2,
                },
            ],
        })

        const next = await syncBackup(deps(), createEmptySyncState('b'))

        expect(next.lastSyncResult).toBe('SUCCESS')
        expect(batchUpsertItems).toHaveBeenCalledTimes(1)
    })

    it('stops reading account keys as soon as a stop lands', async () => {
        const second: WalletAccount = {
            ...watch,
            id: '2',
            chains: { algorand: { address: 'W2' } },
        }
        let stopped = false
        const serializeAccount = vi.fn(async (a: WalletAccount) => {
            stopped = true
            return serialize(a)
        })

        await expect(
            syncBackup(
                {
                    ...deps(),
                    listAccounts: () => [watch, second],
                    serializeAccount,
                    isAborted: () => stopped,
                },
                createEmptySyncState('b'),
            ),
        ).rejects.toThrow(BackupSyncAbortedError)

        expect(serializeAccount).toHaveBeenCalledTimes(1)
    })

    it('drops the push when a stop lands after the accounts are serialized', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g5',
            lastSeq: 0,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        let stopped = false

        await expect(
            syncBackup(
                {
                    ...deps(),
                    serializeAccount: async (a: WalletAccount) => {
                        stopped = true
                        return serialize(a)
                    },
                    isAborted: () => stopped,
                },
                createEmptySyncState('b'),
            ),
        ).rejects.toThrow(BackupSyncAbortedError)

        expect(batchUpsertItems).not.toHaveBeenCalled()
    })

    it('skips the passkey sweep when a stop lands after the accounts are serialized', async () => {
        let stopped = false
        const listPasskeys = vi.fn(async () => [])

        await expect(
            syncBackup(
                {
                    ...deps(),
                    serializeAccount: async (a: WalletAccount) => {
                        stopped = true
                        return serialize(a)
                    },
                    listPasskeys,
                    isAborted: () => stopped,
                },
                createEmptySyncState('b'),
            ),
        ).rejects.toThrow(BackupSyncAbortedError)

        expect(listPasskeys).not.toHaveBeenCalled()
    })

    it('imports nothing when a stop lands during the delta fetch', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g6',
            lastSeq: 1,
            items: {},
        })
        let stopped = false
        fetchDelta.mockImplementationOnce(async () => {
            stopped = true
            return [
                {
                    seq: 1,
                    key: 'accounts/R',
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'h',
                },
            ]
        })
        const stoppable = { ...deps(), isAborted: () => stopped }

        await expect(
            syncBackup(stoppable, createEmptySyncState('b')),
        ).rejects.toThrow(BackupSyncAbortedError)

        expect(readItems).not.toHaveBeenCalled()
        expect(stoppable.importAccounts).not.toHaveBeenCalled()
    })

    it('pushes local contacts alongside accounts', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g3',
            lastSeq: 0,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: contactRecordKey('C1'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 2,
                },
            ],
        })

        const next = await syncBackup(
            {
                ...deps(),
                listContacts: () => [
                    { id: 'C1', addresses: { algorand: 'C1' }, name: 'Alice' },
                ],
            },
            createEmptySyncState('b'),
        )

        const [, , request] = batchUpsertItems.mock.calls[0]
        expect(
            request.items.map((entry: { key: string }) => entry.key).sort(),
        ).toEqual([recordKey('W'), contactRecordKey('C1'), settingsKey].sort())
        expect(next.items[contactRecordKey('C1')]).toMatchObject({
            type: BackupItemType.CONTACT,
            isDirty: false,
            knownVer: 1,
        })
    })

    it('still pushes accounts and contacts when listPasskeys rejects', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g3',
            lastSeq: 0,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: recordKey('W'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 1,
                },
                {
                    key: contactRecordKey('C1'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 2,
                },
            ],
        })
        const warn = vi.spyOn(logger, 'warn')

        const next = await syncBackup(
            {
                ...deps(),
                listContacts: () => [
                    { id: 'C1', addresses: { algorand: 'C1' }, name: 'Alice' },
                ],
                listPasskeys: async () => {
                    throw new Error('KMS session denied')
                },
            },
            createEmptySyncState('b'),
        )

        const [, , request] = batchUpsertItems.mock.calls[0]
        expect(
            request.items.map((entry: { key: string }) => entry.key).sort(),
        ).toEqual([recordKey('W'), contactRecordKey('C1'), settingsKey].sort())
        expect(next.lastSyncResult).toBe('SUCCESS')
        expect(warn).toHaveBeenCalledWith(
            'syncBackup: listPasskeys failed, skipping passkeys',
            { error: 'KMS session denied' },
        )
    })

    it('pushes a credential with its secret and zeroes the key it was handed', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g4',
            lastSeq: 0,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({ results: [] })
        const privateKey = new Uint8Array(32).fill(9)

        await syncBackup(
            {
                ...deps(),
                listPasskeys: async () => [
                    {
                        credentialId: 'Y3JlZC1pZA==',
                        origin: 'webauthn.io',
                        publicKeySpkiDer: 'cHVi',
                        createdAt: 1,
                        privateKey,
                    },
                ],
            },
            createEmptySyncState('b'),
        )

        const [, , request] = batchUpsertItems.mock.calls[0]
        const keys = request.items.map((entry: { key: string }) => entry.key)
        expect(keys).toEqual(
            expect.arrayContaining([
                passkeyItemKey(hashAddress('Y3JlZC1pZA==')),
                passkeySecretsItemKey(hashAddress('Y3JlZC1pZA==')),
            ]),
        )
        expect(privateKey.every(byte => byte === 0)).toBe(true)
    })
})

const encrypted = (key: string, payload: unknown) => ({
    key,
    ver: 2,
    hash: `r-${key}`,
    payload: encryptItemPayload(JSON.stringify(payload), {
        encryptionKey,
        backupId: 'b',
        key,
    }),
})

const settledRecord = (
    key: string,
    record: Record<string, unknown>,
    overrides: Partial<SyncState['items'][string]> = {},
): SyncState['items'][string] => ({
    type: BackupItemType.ACCOUNT,
    knownVer: 2,
    baseVer: 2,
    isDirty: false,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: `r-${key}`,
    localContentHash: itemContentHash(key, record),
    localUpdatedAt: null,
    address: (record.chains as { address: string }[])[0]!.address,
    addresses: (record.chains as { address: string }[]).map(c => c.address),
    record,
    ...overrides,
})

describe('syncBackup after a chain becomes readable', () => {
    const ETH_KEY = recordKey('0xabc')
    const ethRecord = {
        formatVersion: 2,
        customName: 'Eth watch',
        updatedAt: 1,
        chains: [{ chain: 'ethereum', type: 'watch', address: '0xabc' }],
    }

    // A record this device tracked but never read.
    const stateWithUnreadItem = (readableChains?: ChainId[]): SyncState => {
        const state = createEmptySyncState('b')
        state.lastKnownBackupHash = 'g'
        state.lastSyncedSeq = 4
        if (readableChains) state.readableChains = readableChains
        state.items[ETH_KEY] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: `r-${ETH_KEY}`,
            localContentHash: null,
            localUpdatedAt: null,
        }
        return withSyncedSettings(state)
    }

    const syncDeps = () => ({ ...deps(), listAccounts: () => [] })

    beforeEach(() => {
        vi.clearAllMocks()
        registerEthereumAccountsAdapter()
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 4,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        readItems.mockResolvedValue([encrypted(ETH_KEY, ethRecord)])
    })

    it('re-reads the item it skipped and imports it, though the manifest is unchanged', async () => {
        registerEthereumBackupChain()
        const dependencies = syncDeps()

        const next = await syncBackup(dependencies, stateWithUnreadItem())

        expect(readItems).toHaveBeenCalledWith('b', 'dev', [ETH_KEY])
        expect(dependencies.importAccounts).toHaveBeenCalledWith([
            expect.objectContaining({
                address: '0xabc',
                addressPayload: expect.objectContaining({
                    type: 'watch',
                }),
            }),
        ])
        expect(next.readableChains).toEqual(['algorand', 'ethereum'])
        expect(next.items[ETH_KEY]).toMatchObject({ address: '0xabc' })
    })

    it('replays a record it already read once a chain becomes readable', async () => {
        registerEthereumBackupChain()
        const state = stateWithUnreadItem(['algorand'])
        state.items[ETH_KEY] = settledRecord(ETH_KEY, ethRecord)

        await syncBackup(syncDeps(), state)

        expect(readItems).toHaveBeenCalledWith('b', 'dev', [ETH_KEY])
    })

    it('short-circuits when the readable chains are unchanged', async () => {
        registerEthereumBackupChain()

        const next = await syncBackup(
            syncDeps(),
            stateWithUnreadItem(['algorand', 'ethereum']),
        )

        expect(readItems).not.toHaveBeenCalled()
        expect(fetchDelta).not.toHaveBeenCalled()
        expect(next.lastSyncResult).toBe('SUCCESS')
    })

    it('keeps the item unread while its chain is still unreadable', async () => {
        const dependencies = syncDeps()

        const next = await syncBackup(
            dependencies,
            stateWithUnreadItem(['algorand']),
        )

        expect(readItems).not.toHaveBeenCalled()
        expect(next.readableChains).toEqual(['algorand'])
        expect(next.items[ETH_KEY]?.localContentHash).toBeNull()
    })

    it('leaves a held item for the user instead of re-reading it', async () => {
        registerEthereumBackupChain()
        const state = stateWithUnreadItem()
        state.items[ETH_KEY] = { ...state.items[ETH_KEY]!, pendingImport: true }

        await syncBackup(syncDeps(), state)

        expect(readItems).not.toHaveBeenCalled()
    })

    describe('after a failed import', () => {
        const failing = (address = '0xabc') => ({
            ...syncDeps(),
            importAccounts: vi.fn(async () => ({
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address, reason: 'keystore refused' }],
            })),
        })
        const withFailures = (importFailures: number): SyncState => {
            const state = stateWithUnreadItem(['algorand', 'ethereum'])
            state.items[ETH_KEY] = {
                ...state.items[ETH_KEY]!,
                address: '0xabc',
                importFailures,
            }
            return state
        }

        it('leaves the item unread and counts the attempt', async () => {
            registerEthereumBackupChain()

            const next = await syncBackup(failing(), stateWithUnreadItem())

            expect(next.items[ETH_KEY]).toMatchObject({
                localContentHash: null,
                importFailures: 1,
            })
        })

        it('marks the record when a chain other than its first fails', async () => {
            registerEthereumBackupChain()
            readItems.mockResolvedValue([
                encrypted(ETH_KEY, {
                    ...ethRecord,
                    chains: [
                        { chain: 'ethereum', type: 'watch', address: '0xabc' },
                        { chain: 'ethereum2', type: 'watch', address: '0xdef' },
                    ],
                }),
            ])

            const next = await syncBackup(
                failing('0xdef'),
                stateWithUnreadItem(),
            )

            expect(next.items[ETH_KEY]?.importFailures).toBe(1)
        })

        it('re-reads it on a sync whose readable chains are unchanged', async () => {
            registerEthereumBackupChain()

            const next = await syncBackup(failing(), withFailures(1))

            expect(readItems).toHaveBeenCalledWith('b', 'dev', [ETH_KEY])
            expect(next.items[ETH_KEY]?.importFailures).toBe(2)
        })

        it('stops re-reading it once the attempts run out', async () => {
            registerEthereumBackupChain()

            await syncBackup(failing(), withFailures(MAX_IMPORT_ATTEMPTS))

            expect(readItems).not.toHaveBeenCalled()
        })

        it('clears the count once the import succeeds', async () => {
            registerEthereumBackupChain()

            const next = await syncBackup(syncDeps(), withFailures(1))

            expect(next.items[ETH_KEY]?.importFailures).toBeUndefined()
            expect(next.items[ETH_KEY]?.localContentHash).not.toBeNull()
        })
    })

    describe('a record this device holds only part of', () => {
        const KEY = recordKey('W')
        const partial = {
            formatVersion: 2,
            customName: 'Watcher',
            updatedAt: 1,
            chains: [
                { chain: 'algorand', type: 'watch', address: 'W' },
                { chain: 'ethereum', type: 'watch', address: '0xabc' },
            ],
        }
        const stateWith = (importFailures: number): SyncState => {
            const state = stateWithUnreadItem(['algorand', 'ethereum'])
            delete state.items[ETH_KEY]
            state.items[KEY] = settledRecord(KEY, partial, {
                localContentHash: null,
                importFailures,
            })
            return state
        }
        const holding = () => ({
            ...deps(),
            importAccounts: vi.fn(async () => ({
                imported: 0,
                skippedDuplicate: 0,
                failed: [{ address: '0xabc', reason: 'keystore refused' }],
            })),
        })

        beforeEach(() => {
            readItems.mockResolvedValue([encrypted(KEY, partial)])
            batchUpsertItems.mockResolvedValue({
                results: [
                    { key: KEY, result: UpsertResult.OK, new_ver: 3, seq: 5 },
                ],
            })
        })

        it('stays unread and replays while its failed chain has attempts left', async () => {
            registerEthereumBackupChain()

            const next = await syncBackup(holding(), stateWith(1))

            expect(readItems).toHaveBeenCalledWith('b', 'dev', [KEY])
            expect(batchUpsertItems).not.toHaveBeenCalled()
            expect(next.items[KEY]?.importFailures).toBe(2)
        })

        it('pushes a local edit once the attempts run out', async () => {
            registerEthereumBackupChain()

            await syncBackup(
                {
                    ...holding(),
                    listAccounts: () => [{ ...watch, name: 'Renamed' }],
                },
                stateWith(MAX_IMPORT_ATTEMPTS),
            )

            const [, , request] = batchUpsertItems.mock.calls[0]
            expect(
                request.items.map((entry: { key: string }) => entry.key),
            ).toContain(KEY)
        })
    })
})

describe('syncBackup writing an account record', () => {
    const KEY = recordKey('W')

    const stateHolding = (record: Record<string, unknown>): SyncState => {
        const state = createEmptySyncState('b')
        state.lastKnownBackupHash = 'g'
        state.lastSyncedSeq = 4
        state.readableChains = ['algorand']
        state.items[KEY] = settledRecord(KEY, record)
        return withSyncedSettings(state)
    }

    const pushed = (): Record<string, unknown> => {
        const [, , request] = batchUpsertItems.mock.calls[0]
        const entry = request.items.find(
            (item: { key: string }) => item.key === KEY,
        )
        return JSON.parse(
            decryptItemPayload(entry.payload, {
                encryptionKey,
                backupId: 'b',
                key: KEY,
            }),
        )
    }

    beforeEach(() => {
        vi.clearAllMocks()
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g2',
            lastSeq: 4,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                { key: KEY, result: UpsertResult.OK, new_ver: 3, seq: 5 },
            ],
        })
    })

    it('never writes over a record a newer client wrote', async () => {
        const next = await syncBackup(
            deps(),
            stateHolding({
                formatVersion: 3,
                customName: 'Other',
                updatedAt: 1,
                chains: [{ chain: 'algorand', type: 'watch', address: 'W' }],
            }),
        )

        expect(batchUpsertItems).not.toHaveBeenCalled()
        expect(next.items[KEY]?.isDirty).toBe(false)
    })

    it('keeps a chain and a field this build does not know through a rename', async () => {
        await syncBackup(
            deps(),
            stateHolding({
                formatVersion: 2,
                customName: 'Old name',
                updatedAt: 1,
                futureField: 'kept',
                chains: [
                    { chain: 'algorand', type: 'watch', address: 'W' },
                    {
                        chain: 'solana',
                        type: 'watch',
                        address: 'S1',
                        memo: 'm',
                    },
                ],
            }),
        )

        expect(pushed()).toMatchObject({
            customName: 'Watcher',
            futureField: 'kept',
            chains: expect.arrayContaining([
                { chain: 'solana', type: 'watch', address: 'S1', memo: 'm' },
            ]),
        })
    })

    describe('when another device rewrote it in the same sync', () => {
        const before = {
            formatVersion: 2,
            customName: 'Old name',
            updatedAt: 1,
            chains: [{ chain: 'algorand', type: 'watch', address: 'W' }],
        }
        const deliver = (remote: Record<string, unknown>) => {
            fetchDelta.mockResolvedValue([
                {
                    seq: 5,
                    key: KEY,
                    type: BackupItemType.ACCOUNT,
                    ver: 3,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'r2',
                },
            ])
            readItems.mockResolvedValue([
                { ...encrypted(KEY, remote), ver: 3, hash: 'r2' },
            ])
        }

        it('pushes the local rename with the chain the other device added', async () => {
            deliver({
                ...before,
                updatedAt: 5,
                chains: [
                    { chain: 'algorand', type: 'watch', address: 'W' },
                    { chain: 'ethereum', type: 'watch', address: '0xabc' },
                ],
            })

            await syncBackup(deps(), stateHolding(before))

            expect(pushed()).toMatchObject({
                customName: 'Watcher',
                chains: [
                    { chain: 'algorand', type: 'watch', address: 'W' },
                    { chain: 'ethereum', type: 'watch', address: '0xabc' },
                ],
            })
        })

        it("drops the local edit when a newer client's record arrives", async () => {
            deliver({ ...before, formatVersion: 3, updatedAt: 5 })

            const next = await syncBackup(deps(), stateHolding(before))

            expect(batchUpsertItems).not.toHaveBeenCalled()
            expect(next.items[KEY]?.isDirty).toBe(false)
        })
    })

    it('keeps a chain the account lacks on this device', async () => {
        await syncBackup(
            deps(),
            stateHolding({
                formatVersion: 2,
                customName: 'Old name',
                updatedAt: 1,
                chains: [
                    { chain: 'algorand', type: 'watch', address: 'W' },
                    { chain: 'ethereum', type: 'watch', address: '0xabc' },
                ],
            }),
        )

        expect(pushed().chains).toEqual([
            { chain: 'algorand', type: 'watch', address: 'W' },
            { chain: 'ethereum', type: 'watch', address: '0xabc' },
        ])
    })
})

describe('syncBackup writing a contact record', () => {
    const KEY = contactRecordKey('C1')
    const LEGACY_KEY = contactKey('C1')
    const alice = { id: 'C1', addresses: { algorand: 'C1' }, name: 'Alice' }

    // No local accounts, so only the contact items can move the sync.
    const contactDeps = (contacts: Contact[]) => ({
        ...deps(),
        listAccounts: () => [],
        listContacts: () => contacts,
    })

    const settledContact = (
        key: string,
        record: Record<string, unknown>,
    ): SyncState['items'][string] => ({
        ...settledRecord(key, {
            ...record,
            chains: (record.addresses as { address: string }[]).map(a => ({
                address: a.address,
            })),
        }),
        type: BackupItemType.CONTACT,
        localContentHash: itemContentHash(key, record),
        record,
    })

    const stateHolding = (
        record: Record<string, unknown> | null,
    ): SyncState => {
        const state = createEmptySyncState('b')
        state.lastKnownBackupHash = 'g'
        state.lastSyncedSeq = 4
        state.readableChains = ['algorand']
        if (record) state.items[KEY] = settledContact(KEY, record)
        return withSyncedSettings(state)
    }

    const pushedRecord = (): Record<string, unknown> => {
        const [, , request] = batchUpsertItems.mock.calls[0]
        const entry = request.items.find(
            (item: { key: string }) => item.key === KEY,
        )
        return JSON.parse(
            decryptItemPayload(entry.payload, {
                encryptionKey,
                backupId: 'b',
                key: KEY,
            }),
        )
    }

    const remoteRecord = {
        formatVersion: 1,
        id: 'C1',
        name: 'Old name',
        updatedAt: 1,
        addresses: [{ family: 'algorand', address: 'C1' }],
    }

    beforeEach(() => {
        vi.clearAllMocks()
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g2',
            lastSeq: 4,
            items: {},
        })
        fetchDelta.mockResolvedValue([])
        batchUpsertItems.mockResolvedValue({
            results: [
                { key: KEY, result: UpsertResult.OK, new_ver: 3, seq: 5 },
            ],
        })
    })

    it('writes only records, leaving a legacy item where it was', async () => {
        const state = stateHolding(null)
        state.items[LEGACY_KEY] = {
            type: BackupItemType.CONTACT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'legacy',
            localContentHash: null,
            localUpdatedAt: null,
            address: 'C1',
        }

        const next = await syncBackup(contactDeps([alice]), state)

        const [, , request] = batchUpsertItems.mock.calls[0]
        expect(
            request.items.map((entry: { key: string }) => entry.key),
        ).toContain(KEY)
        expect(
            request.items.map((entry: { key: string }) => entry.key),
        ).not.toContain(LEGACY_KEY)
        expect(next.items[LEGACY_KEY]).toEqual(state.items[LEGACY_KEY])
    })

    it('keeps a family this build does not know through a rename', async () => {
        await syncBackup(
            contactDeps([alice]),
            stateHolding({
                ...remoteRecord,
                futureField: 'kept',
                addresses: [
                    { family: 'algorand', address: 'C1' },
                    { family: 'solana', address: 'S1', memo: 'm' },
                ],
            }),
        )

        expect(pushedRecord()).toMatchObject({
            name: 'Alice',
            futureField: 'kept',
            addresses: [
                { family: 'algorand', address: 'C1' },
                { family: 'solana', address: 'S1', memo: 'm' },
            ],
        })
    })

    it('pushes the family a contact gained since the record was written', async () => {
        await syncBackup(
            contactDeps([
                {
                    id: 'C1',
                    addresses: { algorand: 'C1', evm: '0xC1' },
                    name: 'Old name',
                },
            ]),
            stateHolding(remoteRecord),
        )

        expect(pushedRecord().addresses).toEqual([
            { family: 'algorand', address: 'C1' },
            { family: 'evm', address: '0xC1' },
        ])
    })

    it('never writes over a record a newer client wrote', async () => {
        const next = await syncBackup(
            contactDeps([alice]),
            stateHolding({ ...remoteRecord, formatVersion: 2 }),
        )

        expect(batchUpsertItems).not.toHaveBeenCalled()
        expect(next.items[KEY]?.isDirty).toBe(false)
    })

    it("drops the local edit when a newer client's record arrives", async () => {
        fetchDelta.mockResolvedValue([
            {
                seq: 5,
                key: KEY,
                type: BackupItemType.CONTACT,
                ver: 3,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'r2',
            },
        ])
        readItems.mockResolvedValue([
            {
                key: KEY,
                ver: 3,
                hash: 'r2',
                payload: encryptItemPayload(
                    JSON.stringify({
                        ...remoteRecord,
                        formatVersion: 2,
                        updatedAt: 5,
                    }),
                    { encryptionKey, backupId: 'b', key: KEY },
                ),
            },
        ])

        const next = await syncBackup(
            contactDeps([alice]),
            stateHolding(remoteRecord),
        )

        expect(batchUpsertItems).not.toHaveBeenCalled()
        expect(next.items[KEY]?.isDirty).toBe(false)
    })

    it('does not touch a record of unknown families that no local contact matches', async () => {
        const next = await syncBackup(
            contactDeps([]),
            stateHolding({
                ...remoteRecord,
                addresses: [{ family: 'solana', address: 'S1' }],
            }),
        )

        const pushedKeys = batchUpsertItems.mock.calls.flatMap(
            ([, , request]) =>
                request.items.map((entry: { key: string }) => entry.key),
        )
        expect(pushedKeys).not.toContain(KEY)
        expect(next.items[KEY]?.isDirty).toBe(false)
    })

    it('short-circuits even with a legacy item left dirty before the upgrade', async () => {
        const state = stateHolding(null)
        state.items[LEGACY_KEY] = {
            type: BackupItemType.CONTACT,
            knownVer: 1,
            baseVer: 1,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'legacy',
            localContentHash: 'h',
            localUpdatedAt: 3,
            address: 'C1',
        }
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 4,
            items: {},
        })

        const next = await syncBackup(contactDeps([]), state)

        expect(fetchDelta).not.toHaveBeenCalled()
        expect(next.items[LEGACY_KEY]?.isDirty).toBe(false)
    })
})
