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
import type { LocalItem } from './types'

/** Pure: returns a new SyncState with isDirty / pendingDelete / localContentHash
 *  / localUpdatedAt derived from the current local items. `now` is injected for
 *  determinism in tests. */
export const reconcile = (
    state: SyncState,
    localItems: LocalItem[],
    now: number,
): SyncState => {
    const items: Record<string, SyncItemState> = { ...state.items }
    const localByKey = new Map(localItems.map(i => [i.key, i]))

    // 1. Local additions / changes -> dirty.
    for (const local of localItems) {
        const existing = items[local.key]
        if (existing && existing.status === BackupItemStatus.IGNORED) continue

        if (!existing) {
            items[local.key] = {
                type: local.type,
                knownVer: 0,
                baseVer: 0,
                isDirty: true,
                status: BackupItemStatus.ACTIVE,
                lastRemoteHash: null,
                localContentHash: local.contentHash,
                localUpdatedAt: now,
            }
        } else if (existing.localContentHash !== local.contentHash) {
            items[local.key] = {
                ...existing,
                isDirty: true,
                localContentHash: local.contentHash,
                localUpdatedAt: now,
            }
        }
    }

    // 2. Local deletions -> pending-delete for ACTIVE account items.
    for (const [key, item] of Object.entries(items)) {
        if (item.type !== BackupItemType.ACCOUNT) continue
        if (item.status !== BackupItemStatus.ACTIVE) continue
        if (localByKey.has(key)) continue
        items[key] = { ...item, pendingDelete: true }
    }

    return { ...state, items }
}
