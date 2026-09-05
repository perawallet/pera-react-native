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
//
// The buckets asserted here are exactly what the review screens render.
import { describe, expect, it, vi } from 'vitest'
import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    createEmptySyncState,
    deriveBackupAccountReview,
    type SyncState,
} from '../../models'
import { UpsertResult } from '../../api'
import { applyDeltas } from '../applyDeltas'
import { deleteFromBackup, markAccountForBackup } from '../reviewActions'
import { pushDirty } from '../pushDirty'
import { reconcile } from '../reconcile'
import type { LocalItem, LocalSnapshot } from '../types'

const ADDRESS = 'ACCOUNTX'
const ACCOUNT_KEY = `accounts/${ADDRESS}`
const NOW = 1_000

const localItem = (hash: string): LocalItem => ({
    key: ACCOUNT_KEY,
    type: BackupItemType.ACCOUNT,
    contentHash: hash,
    payload: { type: 'watch', address: ADDRESS } as never,
})

const snapshot = (items: LocalItem[]): LocalSnapshot => ({ items, skipped: 0 })

const syncedState = (): SyncState => {
    const state = createEmptySyncState('b')
    state.items[ACCOUNT_KEY] = {
        type: BackupItemType.ACCOUNT,
        knownVer: 1,
        baseVer: 1,
        isDirty: false,
        status: BackupItemStatus.ACTIVE,
        lastRemoteHash: 'r1',
        localContentHash: 'h1',
        localUpdatedAt: null,
    }
    return state
}

const pushDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey: new Uint8Array(32).fill(7),
    batchUpsertItems: vi.fn(async () => ({
        results: [
            {
                key: ACCOUNT_KEY,
                result: UpsertResult.OK,
                new_ver: 2,
                seq: 7,
            },
        ],
    })),
    deleteItem: vi.fn(async () => ({ seq: 6 })),
})

const pullDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey: new Uint8Array(32).fill(7),
    importAccounts: vi.fn(async () => ({
        imported: 1,
        skippedDuplicate: 0,
        failed: [],
    })),
    readItems: vi.fn(async () => []),
    decrypt: vi.fn(() => '{}'),
})

describe('an account deleted on one device and re-backed-up on another', () => {
    it('leaves device A a tombstone rather than forgetting the account', async () => {
        const deleteItem = vi.fn(async () => ({ seq: 6 }))

        const next = await deleteFromBackup({
            state: syncedState(),
            address: ADDRESS,
            deps: { ...pullDeps(), deleteItem },
        })

        expect(deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'b',
            'dev',
            ACCOUNT_KEY,
        )
        expect(next.items[ACCOUNT_KEY].status).toBe(BackupItemStatus.IGNORED)
    })

    it('shows the account as not backed up on device B, which still holds it', async () => {
        const deps = pullDeps()
        const afterPull = await applyDeltas({
            state: syncedState(),
            deltas: [
                {
                    seq: 6,
                    key: ACCOUNT_KEY,
                    type: BackupItemType.ACCOUNT,
                    ver: 2,
                    status: BackupItemStatus.IGNORED,
                    op: DeltaOperation.DELETE,
                    hash: null,
                },
            ],
            deps,
        })

        const review = deriveBackupAccountReview(afterPull, [ADDRESS])
        expect(review.notBackedUp).toEqual([ADDRESS])
        expect(review.availableFromBackup).toEqual([])
    })

    it('re-uploads at version 0 when device B backs it up again', async () => {
        const deps = pushDeps()
        const tombstoned = createEmptySyncState('b')
        tombstoned.items[ACCOUNT_KEY] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            status: BackupItemStatus.IGNORED,
            lastRemoteHash: 'r2',
            localContentHash: null,
            localUpdatedAt: null,
        }

        const staged = reconcile(
            markAccountForBackup(tombstoned, ADDRESS),
            snapshot([localItem('h1')]),
            NOW,
        )
        expect(staged.items[ACCOUNT_KEY]).toMatchObject({
            status: BackupItemStatus.ACTIVE,
            isDirty: true,
            baseVer: 0,
        })

        await pushDirty({
            state: staged,
            localItems: [localItem('h1')],
            deps,
        })

        const [[, , , request]] = deps.batchUpsertItems.mock.calls
        expect(request.items[0]).toMatchObject({
            key: ACCOUNT_KEY,
            expected_ver: 0,
            status: BackupItemStatus.ACTIVE,
        })
    })

    it('offers the returning account back to device A instead of importing it', async () => {
        const deps = pullDeps()
        const tombstoned = createEmptySyncState('b')
        tombstoned.items[ACCOUNT_KEY] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            status: BackupItemStatus.IGNORED,
            lastRemoteHash: 'r2',
            localContentHash: null,
            localUpdatedAt: null,
        }

        const afterPull = await applyDeltas({
            state: tombstoned,
            deltas: [
                {
                    seq: 8,
                    key: ACCOUNT_KEY,
                    type: BackupItemType.ACCOUNT,
                    ver: 3,
                    status: BackupItemStatus.ACTIVE,
                    op: DeltaOperation.UPSERT,
                    hash: 'r3',
                },
            ],
            deps,
        })

        expect(deps.importAccounts).not.toHaveBeenCalled()

        const review = deriveBackupAccountReview(afterPull, [])
        expect(review.availableFromBackup).toEqual([ADDRESS])

        // And the next reconcile must not read that absence as a fresh delete.
        const afterReconcile = reconcile(afterPull, snapshot([]), NOW)
        expect(afterReconcile.items[ACCOUNT_KEY].pendingDelete).toBeUndefined()
    })
})
