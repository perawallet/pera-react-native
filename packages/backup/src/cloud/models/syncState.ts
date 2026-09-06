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
    ManifestItem,
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
    /** Live in the backup but deliberately absent here: this device deleted the
     *  account, then another device backed it up again. Held for the user to
     *  Add or delete rather than silently re-imported. */
    pendingImport?: boolean
    /** Epoch millis local content last diverged; written as payload.updatedAt. */
    localUpdatedAt?: number | null
    /** Display name cached for CONTACT items, so a contact that lives only in
     *  the backup can be named in the review list without downloading it
     *  there. Null for every other type; safe to cache because a contact
     *  payload holds no secret material. */
    label?: string | null
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

/**
 * The manifest is the server's own per-key sync state, so adopting it wholesale
 * is how a device learns what version every item is at. Getting this wrong is
 * unrecoverable rather than merely stale: an item tracked at version 0 pushes
 * `expected_ver: 0`, the server refuses it, and no delta ever follows to correct
 * the version — so it re-conflicts on every sync forever.
 *
 * `localContentHash` stays null because the manifest carries the server's own
 * item hash, not the hash of our canonical plaintext. The next reconcile
 * therefore sees each item as changed and re-uploads it once, at the right
 * version.
 */
export const trackedItemsFromManifest = (
    manifestItems: Record<BackupItemKey, ManifestItem>,
): Record<BackupItemKey, SyncItemState> =>
    Object.fromEntries(
        Object.entries(manifestItems).map(([key, item]) => [
            key,
            {
                type: item.type,
                knownVer: item.ver,
                baseVer: item.ver,
                isDirty: false,
                status: item.status,
                lastRemoteHash: item.hash,
                localContentHash: null,
                localUpdatedAt: null,
            },
        ]),
    )
