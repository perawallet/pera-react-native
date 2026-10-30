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

import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import type { BackupItemKind, BackupSettings } from './payloads'
import type {
    BackupGlobalHash,
    BackupId,
    BackupItemKey,
    BackupItemStatus,
    BackupItemType,
    ItemHash,
    ManifestItem,
} from './types'

export type SettingsFieldState<T> = {
    value: T
    /** Epoch millis of the edit that produced `value`; 0 = never edited. */
    updatedAt: number
    /** Canonical JSON of this device's own value when last observed, which is
     *  what separates a user edit from a remote value this device declined to
     *  apply. Null until observed: seeded by a restore or an import. */
    observed: Nullable<string>
}

export type SettingsDocument = {
    [K in keyof BackupSettings]?: SettingsFieldState<BackupSettings[K]>
}

export type SyncItemState = {
    type: BackupItemType
    knownVer: number
    baseVer: number
    isDirty: boolean
    status: BackupItemStatus
    /** Server's opaque item hash; detects REMOTE changes only. */
    lastRemoteHash: Nullable<ItemHash>
    /** SHA-256 of canonical PLAINTEXT (sans updatedAt); detects LOCAL changes. */
    localContentHash?: Nullable<string>
    pendingDelete?: boolean
    /** Live in the backup but deliberately absent here: this device deleted the
     *  account, then another device backed it up again. Held for the user to
     *  Add or delete rather than silently re-imported. */
    pendingImport?: boolean
    /** Account family only: syncs in a row whose import of this remote version
     *  failed. Capped by `MAX_IMPORT_ATTEMPTS`. */
    importFailures?: number
    /** Epoch millis local content last diverged; written as payload.updatedAt. */
    localUpdatedAt?: Nullable<number>
    /** Display name cached for CONTACT and PASSKEY items, so an item that
     *  lives only in the backup can be named in the review list without
     *  downloading it there. Null for every other type; safe to cache because
     *  neither payload holds secret material. */
    label?: Nullable<string>
    /** Null means never decrypted — unknown, never "not ours". An account
     *  record's primary address. */
    address?: Nullable<string>
    /** Account and contact records only: every chain's address, so an action
     *  on any of them finds the record. */
    addresses?: Nullable<string[]>
    /** Account and contact records only: the content last seen or written. A
     *  write is laid over it (`mergeAccountRecord`, `mergeContactRecord`) so
     *  what this build can't read survives,
     *  and a record a newer client wrote is never overwritten. Holds no key
     *  material; that lives in `secrets/` items. */
    record?: Nullable<Record<string, unknown>>
    accountType?: Nullable<BackupItemKind>
    /** SETTINGS only. Unlike every other type, a settings push is built from
     *  this document rather than from the device's current values, so a
     *  remote value this device could not apply is not overwritten by it. */
    settingsFields?: SettingsDocument
}

export type BackupSyncResult = 'SUCCESS' | 'FAILED'

export type SyncState = {
    backupId: BackupId
    lastKnownBackupHash: Nullable<BackupGlobalHash>
    lastSyncedSeq: number
    /** Epoch millis of the last completed sync; null until first sync. */
    lastSyncedAt: Nullable<number>
    lastSyncResult: Nullable<BackupSyncResult>
    /** Sorted chains this client could read at its last sync. A change re-reads
     *  the account items it skipped. Absent on state that predates it. */
    readableChains?: ChainId[]
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
