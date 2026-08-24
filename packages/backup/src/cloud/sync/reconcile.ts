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
    BackupItemStatus,
    BackupItemType,
    type SyncItemState,
    type SyncState,
} from '../models'
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
})

const markChanged = (
    tracked: SyncItemState,
    item: LocalItem,
    now: number,
): SyncItemState => ({
    ...tracked,
    isDirty: true,
    localContentHash: item.contentHash,
    localUpdatedAt: now,
})

const hasChanged = (tracked: SyncItemState, item: LocalItem): boolean =>
    tracked.localContentHash !== item.contentHash

const withLocalChanges = (
    items: SyncItems,
    localItems: LocalItem[],
    now: number,
): SyncItems => {
    const next: SyncItems = { ...items }
    for (const item of localItems) {
        const tracked = next[item.key]
        if (tracked?.status === BackupItemStatus.IGNORED) continue

        if (!tracked) next[item.key] = trackNewItem(item, now)
        else if (hasChanged(tracked, item))
            next[item.key] = markChanged(tracked, item, now)
    }
    return next
}

const isDeletedLocally = (
    tracked: SyncItemState,
    key: string,
    localKeys: Set<string>,
): boolean =>
    tracked.type === BackupItemType.ACCOUNT &&
    tracked.status === BackupItemStatus.ACTIVE &&
    !localKeys.has(key)

const withPendingDeletes = (
    items: SyncItems,
    localKeys: Set<string>,
): SyncItems => {
    const next: SyncItems = { ...items }
    for (const [key, tracked] of Object.entries(next)) {
        if (isDeletedLocally(tracked, key, localKeys))
            next[key] = { ...tracked, pendingDelete: true }
    }
    return next
}

/** Pure: returns a new SyncState with isDirty / pendingDelete / localContentHash
 *  / localUpdatedAt derived from the current local items. */
export const reconcile = (
    state: SyncState,
    local: LocalSnapshot,
    now: number,
): SyncState => {
    const items = withLocalChanges(state.items, local.items, now)

    // An unreadable secret serializes to nothing, which is the same signal as a
    // user deletion — so deleting on an incomplete pass wipes the backup.
    if (local.skipped > 0) return { ...state, items }

    const localKeys = new Set(local.items.map(item => item.key))
    return { ...state, items: withPendingDeletes(items, localKeys) }
}
