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

const fetchDelta = vi.fn()
const readItems = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
    readItems: (...a: unknown[]) => readItems(...a),
}))

import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    createEmptySyncState,
} from '../../models'
import { pullBackupDeltas } from '../pullBackupDeltas'

const encryptionKey = new Uint8Array(32).fill(7)
const deps = () => ({
    network: 'mainnet' as const,
    backupId: 'b',
    deviceId: 'dev',
    encryptionKey,
    importAccounts: vi.fn(async () => ({
        imported: 0,
        skippedDuplicate: 0,
        failed: [],
    })),
})

describe('pullBackupDeltas', () => {
    beforeEach(() => {
        fetchDelta.mockReset()
        readItems.mockReset()
    })

    it('fetches deltas from the cursor, applies them, and advances lastSyncedSeq', async () => {
        fetchDelta.mockResolvedValue([
            {
                seq: 9,
                key: 'accounts/X',
                type: BackupItemType.ACCOUNT,
                ver: 1,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'h',
            },
        ])
        // Return no item bodies so applyDeltas advances the cursor without needing a real decrypt.
        readItems.mockResolvedValue([])
        const next = await pullBackupDeltas(deps(), createEmptySyncState('b'))
        expect(fetchDelta).toHaveBeenCalledWith('mainnet', 'b', 'dev', 0)
        expect(next.lastSyncedSeq).toBe(9)
    })

    it('is a no-op (no error) when there are no deltas', async () => {
        fetchDelta.mockResolvedValue([])
        const next = await pullBackupDeltas(deps(), createEmptySyncState('b'))
        expect(next.lastSyncedSeq).toBe(0)
        expect(readItems).not.toHaveBeenCalled()
    })
})
