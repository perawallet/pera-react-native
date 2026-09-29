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
const fetchManifest = vi.fn()
const readItems = vi.fn()
vi.mock('../../api', async importOriginal => ({
    ...(await importOriginal<object>()),
    fetchDelta: (...a: unknown[]) => fetchDelta(...a),
    fetchManifest: (...a: unknown[]) => fetchManifest(...a),
    readItems: (...a: unknown[]) => readItems(...a),
}))

import { logger } from '@perawallet/wallet-core-shared'
import { FromSeqTooOldError } from '../../api'
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemStatus,
    BackupItemType,
    DeltaOperation,
    accountItemKey,
    createEmptySyncState,
} from '../../models'
import { pullBackupDeltas } from '../pullBackupDeltas'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))
const ACCOUNT_KEY = accountItemKey(hashAddress('X'))
const LEGACY_KEY = 'accounts/X'

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
    importContacts: vi.fn(async () => ({ imported: 0, failed: [] })),
    importPasskeys: vi.fn(async () => ({
        imported: 0,
        skipped: [],
        failed: [],
    })),
})

describe('pullBackupDeltas', () => {
    beforeEach(() => {
        fetchDelta.mockReset()
        fetchManifest.mockReset()
        readItems.mockReset()
    })

    it('fetches deltas from the cursor, applies them, and advances lastSyncedSeq', async () => {
        fetchDelta.mockResolvedValue([
            {
                seq: 9,
                key: ACCOUNT_KEY,
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

    // Retention pruned the window this device's cursor pointed into. Without
    // the manifest rebuild the cursor never moves again and every later pull
    // fails the same way.
    it('rebuilds from the manifest when the cursor has been pruned', async () => {
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 100,
            items: {
                [ACCOUNT_KEY]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'h',
                    lastSeq: 97,
                },
            },
        })
        readItems.mockResolvedValue([])

        const next = await pullBackupDeltas(deps(), {
            ...createEmptySyncState('b'),
            lastSyncedSeq: 3,
        })

        expect(next.lastSyncedSeq).toBe(100)
        expect(next.lastSyncResult).toBe('SUCCESS')
        expect(next.items[ACCOUNT_KEY].knownVer).toBe(1)
    })

    it('refuses deltas from a backup still keyed by plaintext address', async () => {
        fetchDelta.mockResolvedValue([
            {
                seq: 9,
                key: LEGACY_KEY,
                type: BackupItemType.ACCOUNT,
                ver: 1,
                status: BackupItemStatus.ACTIVE,
                op: DeltaOperation.UPSERT,
                hash: 'h',
            },
        ])
        const warn = vi.spyOn(logger, 'warn')

        const next = await pullBackupDeltas(deps(), createEmptySyncState('b'))

        expect(next.lastSyncResult).toBe('FAILED')
        expect(next.lastSyncedSeq).toBe(0)
        expect(next.items).toEqual({})
        expect(readItems).not.toHaveBeenCalled()
        expect(warn).toHaveBeenCalledWith(
            'pullBackupDeltas: backup uses legacy address keys, refusing to apply',
            { legacyKeyCount: 1 },
        )
    })

    it('refuses a manifest rebuild that carries legacy keys', async () => {
        fetchDelta.mockRejectedValueOnce(new FromSeqTooOldError(3))
        fetchManifest.mockResolvedValue({
            backupGlobalHash: 'g',
            lastSeq: 100,
            items: {
                [LEGACY_KEY]: {
                    type: BackupItemType.ACCOUNT,
                    ver: 1,
                    status: BackupItemStatus.ACTIVE,
                    hash: 'h',
                    lastSeq: 97,
                },
            },
        })

        const next = await pullBackupDeltas(deps(), {
            ...createEmptySyncState('b'),
            lastSyncedSeq: 3,
        })

        expect(next.lastSyncResult).toBe('FAILED')
        expect(next.lastSyncedSeq).toBe(3)
        expect(readItems).not.toHaveBeenCalled()
    })

    it('records the pull as a successful sync', async () => {
        fetchDelta.mockResolvedValue([])
        const next = await pullBackupDeltas(
            deps(),
            createEmptySyncState('b'),
            1_700_000_000_000,
        )
        expect(next.lastSyncResult).toBe('SUCCESS')
        expect(next.lastSyncedAt).toBe(1_700_000_000_000)
    })
})
