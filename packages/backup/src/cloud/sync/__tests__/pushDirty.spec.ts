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
import { describe, expect, it, vi } from 'vitest'
import {
    BackupItemStatus,
    BackupItemType,
    createEmptySyncState,
} from '../../models'
import { UpsertResult } from '../../api'
import { pushDirty } from '../pushDirty'
import type { LocalItem } from '../types'

const encryptionKey = new Uint8Array(32).fill(7)
const item = (key: string): LocalItem => ({
    key,
    type: BackupItemType.ACCOUNT,
    contentHash: 'h',
    payload: {
        type: 'watch',
        address: key.split('/')[1],
        updatedAt: 0,
    } as never,
})
const baseDeps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey,
    batchUpsertItems: vi.fn(),
    deleteItem: vi.fn(async () => ({ seq: 99 })),
})

describe('pushDirty', () => {
    it('pushes dirty items and on OK clears dirty + advances ver/seq', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: 'accounts/A',
                    result: UpsertResult.OK,
                    new_ver: 8,
                    seq: 51,
                },
            ],
        })
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 7,
            baseVer: 7,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 200,
        }
        const next = await pushDirty({
            state,
            localItems: [item('accounts/A')],
            deps,
        })
        expect(deps.batchUpsertItems).toHaveBeenCalledTimes(1)
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: false,
            knownVer: 8,
            baseVer: 8,
        })
        expect(next.lastSyncedSeq).toBe(51)
    })

    it('on VERSION_CONFLICT leaves the item dirty for the next sync', async () => {
        const deps = baseDeps()
        deps.batchUpsertItems.mockResolvedValue({
            results: [
                {
                    key: 'accounts/A',
                    result: UpsertResult.VERSION_CONFLICT,
                    current_ver: 9,
                    current_hash: 'rh',
                },
            ],
        })
        const state = createEmptySyncState('b')
        state.items['accounts/A'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 7,
            baseVer: 7,
            isDirty: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 200,
        }
        const next = await pushDirty({
            state,
            localItems: [item('accounts/A')],
            deps,
        })
        // Stays dirty, records the server's current_ver, but DELIBERATELY keeps
        // lastRemoteHash STALE ('r', not the conflict's 'rh'). The stale hash is
        // what makes the next sync's applyDeltas re-download this item and run
        // last-write-wins; advancing it here would livelock the conflict.
        expect(next.items['accounts/A']).toMatchObject({
            isDirty: true,
            knownVer: 9,
            lastRemoteHash: 'r',
        })
    })

    it('processes pending-delete keys via deleteItem and removes them from items', async () => {
        const deps = baseDeps()
        const state = createEmptySyncState('b')
        state.items['accounts/GONE'] = {
            type: BackupItemType.ACCOUNT,
            knownVer: 2,
            baseVer: 2,
            isDirty: false,
            pendingDelete: true,
            status: BackupItemStatus.ACTIVE,
            lastRemoteHash: 'r',
            localContentHash: 'h',
            localUpdatedAt: 1,
        }
        const next = await pushDirty({ state, localItems: [], deps })
        expect(deps.deleteItem).toHaveBeenCalledWith(
            'mainnet',
            'b',
            'dev',
            'accounts/GONE',
        )
        expect(next.items['accounts/GONE']).toBeUndefined()
    })
})
