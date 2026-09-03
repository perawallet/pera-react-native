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
import { UpsertResult } from '../../api'
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
} from '../../models'
import { serializeAccountItems } from '../serializeAccountItems'
import { syncBackup } from '../syncBackup'
import { canonicalJson, contentHash } from '../canonicalize'

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
    listAccounts: () => [watch],
    serializeAccount: async (a: WalletAccount) =>
        serializeAccountItems(a, { updatedAt: 1, secrets: null }),
    importAccounts: vi.fn(async () => ({
        imported: 0,
        skippedDuplicate: 0,
        failed: [],
    })),
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
        state.items['accounts/W'] = {
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
        }
        const next = await syncBackup(deps(), state)
        expect(fetchDelta).not.toHaveBeenCalled()
        expect(next.lastSyncResult).toBe('SUCCESS')
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
                    key: 'accounts/W',
                    result: UpsertResult.OK,
                    new_ver: 1,
                    seq: 1,
                },
            ],
        })
        const next = await syncBackup(deps(), createEmptySyncState('b'))
        expect(batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.items['accounts/W']).toMatchObject({
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
                    key: 'accounts/W',
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
        state.items['accounts/W'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 1,
            baseVer: 1,
            isDirty: false,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'previously-synced',
            localUpdatedAt: null,
        }

        const next = await syncBackup(
            { ...deps(), serializeAccount: async () => null },
            state,
        )

        expect(deleteItem).not.toHaveBeenCalled()
        expect(next.items['accounts/W'].pendingDelete).toBeUndefined()
    })
})
