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

import {
    BACKUP_SECRETS_KEY_PREFIX,
    BackupItemStatus,
    cachedRecordSeedReference,
    isAccountRecordKey,
    isNewerAccountRecord,
    type SyncItemState,
    type SyncState,
} from '../models'
import { isImportRetryDue } from './importRetry'
import type { LocalItem, LocalSnapshot } from './types'

type SyncItems = Record<string, SyncItemState>

const trackNewItem = (item: LocalItem, now: number): SyncItemState => ({
    type: item.type,
    knownVer: 0,
    baseVer: 0,
    isDirty: true,
    status: BackupItemStatus.ACTIVE,
    lastRemoteHash: null,
    localContentHash: item.contentHash,
    localUpdatedAt: now,
    ...identifiersOf(item),
})

const markChanged = (
    tracked: SyncItemState,
    item: LocalItem,
    now: number,
): SyncItemState => ({
    ...tracked,
    isDirty: true,
    pendingImport: false,
    localContentHash: item.contentHash,
    localUpdatedAt: now,
    ...identifiersOf(item),
})

/** A record also caches every chain address and the content written, which
 *  the next write is laid over. */
const identifiersOf = (item: LocalItem): Partial<SyncItemState> => ({
    address: item.address,
    accountType: item.accountType,
    ...(item.addresses
        ? {
              addresses: item.addresses,
              record: item.payload as Record<string, unknown>,
          }
        : {}),
})

const hasChanged = (tracked: SyncItemState, item: LocalItem): boolean =>
    tracked.localContentHash !== item.contentHash

/**
 * A secret another device deleted while a live record here still needs it.
 * An older client counts only legacy items when it decides a seed is unused,
 * so it deletes one this client's records derive from. Re-uploaded, or a
 * restore could no longer re-derive those accounts.
 */
const isSecretOfLiveRecord = (state: SyncState, item: LocalItem): boolean =>
    item.key.startsWith(BACKUP_SECRETS_KEY_PREFIX) &&
    Object.entries(state.items).some(
        ([key, tracked]) =>
            isAccountRecordKey(key) &&
            tracked.status === BackupItemStatus.ACTIVE &&
            tracked.pendingDelete !== true &&
            (tracked.addresses?.includes(item.address) === true ||
                cachedRecordSeedReference(tracked.record) === item.address),
    )

/** Absence is deliberately not a signal. An account missing locally is not a
 *  request to delete it from the server — only the user is, through the removal
 *  flow. That keeps a device wipe from emptying the backup. */
export const reconcile = (
    state: SyncState,
    local: LocalSnapshot,
    now: number,
): SyncState => {
    const items: SyncItems = { ...state.items }
    for (const item of local.items) {
        const tracked = items[item.key]
        if (tracked?.status === BackupItemStatus.IGNORED) {
            if (isSecretOfLiveRecord(state, item)) {
                items[item.key] = trackNewItem(item, now)
            }
            continue
        }
        // A newer client wrote it in a shape this build would downgrade.
        if (isNewerAccountRecord(tracked?.record)) continue
        // Left unread for an import retry. The account may be here in part,
        // and writing that part back would mark the record read before the
        // retry runs. An edit made meanwhile goes out once the retries end.
        if (
            tracked &&
            tracked.localContentHash == null &&
            isImportRetryDue(tracked)
        )
            continue

        if (!tracked) items[item.key] = trackNewItem(item, now)
        else if (hasChanged(tracked, item))
            items[item.key] = markChanged(tracked, item, now)
        // The account is on the device again, so there is nothing left to
        // review — however it got here, Add or a plain re-import.
        else if (tracked.pendingImport)
            items[item.key] = { ...tracked, pendingImport: false }
    }
    return { ...state, items }
}
