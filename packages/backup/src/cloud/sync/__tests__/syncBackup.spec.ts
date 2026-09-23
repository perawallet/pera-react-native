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

import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { logger, PeraNetworkError } from '@perawallet/wallet-core-shared'
import { FromSeqTooOldError, UpsertResult } from '../../api'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemStatus,
    BackupItemType,
    accountItemKey,
    contactItemKey,
    createEmptySyncState,
} from '../../models'
import { serializeAccountItems } from '../serializeAccountItems'
import { syncBackup } from '../syncBackup'
import { canonicalJson, contentHash } from '../canonicalize'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const accountKey = (address: string) => accountItemKey(hashAddress(address))
const contactKey = (address: string) => contactItemKey(hashAddress(address))

const encryptionKey = new Uint8Array(32).fill(7)
const watch: WalletAccount = {
    id: '1',
    type: AccountTypes.watch,
    address: 'W',
    name: 'Watcher',
}

const deps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey,
    hashAddress,
    listAccounts: () => [watch],
    listContacts: () => [],
    serializeAccount: async (a: WalletAccount) =>
        serializeAccountItems(a, { updatedAt: 1, secrets: null, hashAddress }),
    importAccounts: vi.fn(async () => ({
        imported: 0,
        skippedDuplicate: 0,
        failed: [],
    })),
    importContacts: vi.fn(async () => ({ imported: 0, failed: [] })),
})

describe('syncBackup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('short-circuits to UpToDate when remote hash matches and nothing is dirty', async () => {
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 10,
            items: {},
        })
        const state = createEmptySyncState('b')
        state.lastKnownBackupHash = 'g'
        state.items[accountKey('W')] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: contentHash(
                canonicalJson({
                    type: 'watch',
                    address: 'W',
                    customName: 'Watcher',
                }),
            ),
            localUpdatedAt: 1,
            address: 'W',
        }
        const next = await syncBackup(deps(), state)
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
                [accountKey('W')]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'r',
                    lastSeq: 97,
                },
            },
        })
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))
        const state = createEmptySyncState('b')
        state.lastSyncedSeq = 3
        state.lastKnownBackupHash = 'stale'
        state.items[accountKey('W')] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: contentHash(
                canonicalJson({
                    type: 'watch',
                    address: 'W',
                    customName: 'Watcher',
                }),
            ),
            localUpdatedAt: 1,
            address: 'W',
        }

        const next = await syncBackup(deps(), state)

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
                    key: accountKey('W'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 1,
                },
            ],
        })
        const next = await syncBackup(deps(), createEmptySyncState('b'))
        expect(batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.items[accountKey('W')]).toMatchObject({
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
                    key: accountKey('W'),
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
        state.items[accountKey('W')] = {
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
        expect(next.items[accountKey('W')].pendingDelete).toBeUndefined()
    })

    // An address-keyed backup predates key hashing. Its items decrypt fine, so
    // syncing would import them and then push the same accounts back under
    // hashed keys, doubling the backup.
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
                [accountKey('W')]: {
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
                    key: accountKey('W'),
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
                    key: contactKey('C1'),
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 2,
                },
            ],
        })

        const next = await syncBackup(
            {
                ...deps(),
                listContacts: () => [{ address: 'C1', name: 'Alice' }],
            },
            createEmptySyncState('b'),
        )

        const [, , , request] = batchUpsertItems.mock.calls[0]
        expect(
            request.items.map((entry: { key: string }) => entry.key).sort(),
        ).toEqual([accountKey('W'), contactKey('C1')].sort())
        expect(next.items[contactKey('C1')]).toMatchObject({
            type: BackupItemType.CONTACT,
            isDirty: false,
            knownVer: 1,
        })
    })
})
