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

import type {
    BackupGlobalHash,
    BackupId,
    BackupItemKey,
    BackupItemStatus,
    BackupItemType,
    ItemHash,
} from './types'

export type SyncItemState = {
    type: BackupItemType
    knownVer: number
    baseVer: number
    isDirty: boolean
    status: BackupItemStatus
    /** Server's opaque item hash; detects REMOTE changes only. */
    lastRemoteHash: ItemHash | null
    /** SHA-256 of canonical PLAINTEXT (sans updatedAt); detects LOCAL changes. */
    localContentHash?: string | null
    pendingDelete?: boolean
    /** Epoch millis local content last diverged; written as payload.updatedAt. */
    localUpdatedAt?: number | null
}

export type BackupSyncResult = 'SUCCESS' | 'FAILED'

export type SyncState = {
    backupId: BackupId
    lastKnownBackupHash: BackupGlobalHash | null
    lastSyncedSeq: number
    /** Epoch millis of the last completed sync; null until first sync. */
    lastSyncedAt: number | null
    lastSyncResult: BackupSyncResult | null
    items: Record<BackupItemKey, SyncItemState>
}

export const createEmptySyncState = (backupId: BackupId): SyncState => ({
    backupId,
    lastKnownBackupHash: null,
    lastSyncedSeq: 0,
    lastSyncedAt: null,
    lastSyncResult: null,
    items: {},
})
