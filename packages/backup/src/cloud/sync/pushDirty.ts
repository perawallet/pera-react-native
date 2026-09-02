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

import type { Network } from '@perawallet/wallet-core-shared'
import { logger } from '@perawallet/wallet-core-shared'
import {
    UpsertResult,
    type BatchUpsertRequest,
    type BatchUpsertResponse,
    type DeleteItemResponse,
} from '../api'
import { encryptItemPayload } from '../crypto/itemPayload'
import {
    isAccountItemKey,
    BackupItemStatus,
    type BackupId,
    type BackupItemKey,
    type DeviceId,
    type SyncItemState,
    type SyncState,
} from '../models'
import { canonicalJson } from './canonicalize'
import type { LocalItem } from './types'

export type PushDirtyDeps = {
    network: Network
    backupId: BackupId
    deviceId: DeviceId
    encryptionKey: Uint8Array
    batchUpsertItems: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        request: BatchUpsertRequest,
    ) => Promise<BatchUpsertResponse>
    deleteItem: (
        network: Network,
        backupId: BackupId,
        deviceId: DeviceId,
        key: BackupItemKey,
    ) => Promise<DeleteItemResponse>
}

/** Inject the LWW timestamp into the address payload before encrypting. */
const withUpdatedAt = (
    item: LocalItem,
    updatedAt: number | null | undefined,
): string => {
    const payload =
        isAccountItemKey(item.key) && updatedAt != null
            ? { ...(item.payload as Record<string, unknown>), updatedAt }
            : item.payload
    return canonicalJson(payload)
}

export const pushDirty = async ({
    state,
    localItems,
    deps,
}: {
    state: SyncState
    localItems: LocalItem[]
    deps: PushDirtyDeps
}): Promise<SyncState> => {
    const items: Record<string, SyncItemState> = { ...state.items }
    let lastSyncedSeq = state.lastSyncedSeq
    const localByKey = new Map(localItems.map(i => [i.key, i]))

    // 1. Process pending-delete keys first.
    for (const [key, item] of Object.entries(items)) {
        if (!item.pendingDelete) continue
        try {
            const res = await deps.deleteItem(
                deps.network,
                deps.backupId,
                deps.deviceId,
                key,
            )
            lastSyncedSeq = Math.max(lastSyncedSeq, res.seq)
            delete items[key]
        } catch (error) {
            logger.warn('pushDirty: delete failed', {
                key,
                error: error instanceof Error ? error.message : String(error),
            })
        }
    }

    // 2. Batch-upsert dirty, non-IGNORED, non-pending-delete items.
    const dirtyKeys = Object.keys(items).filter(
        key =>
            items[key].isDirty &&
            items[key].status !== BackupItemStatus.IGNORED &&
            !items[key].pendingDelete,
    )

    const entries = dirtyKeys
        .map(key => {
            const local = localByKey.get(key)
            if (!local) return null
            const plaintext = withUpdatedAt(local, items[key].localUpdatedAt)
            const payload = encryptItemPayload(plaintext, {
                encryptionKey: deps.encryptionKey,
                backupId: deps.backupId,
                key,
            })
            return {
                key,
                type: local.type,
                expected_ver: items[key].baseVer,
                status: items[key].status,
                payload,
            }
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)

    if (entries.length === 0) return { ...state, items, lastSyncedSeq }

    const response = await deps.batchUpsertItems(
        deps.network,
        deps.backupId,
        deps.deviceId,
        {
            device_id: deps.deviceId,
            items: entries,
        },
    )

    for (const result of response.results) {
        const existing = items[result.key]
        if (!existing) continue
        if (result.result === UpsertResult.OK && result.new_ver != null) {
            items[result.key] = {
                ...existing,
                knownVer: result.new_ver,
                baseVer: result.new_ver,
                isDirty: false,
                localUpdatedAt: null,
            }
            if (result.seq != null)
                lastSyncedSeq = Math.max(lastSyncedSeq, result.seq)
        } else if (result.result === UpsertResult.VERSION_CONFLICT) {
            // Keep the item dirty and DELIBERATELY leave `lastRemoteHash` stale.
            // The next sync's applyDeltas compares the delta hash against this
            // stale value: keeping it stale forces a re-download of the item so
            // last-write-wins runs (and advances `baseVer`, resolving the
            // conflict). Advancing `lastRemoteHash` to `current_hash` here would
            // make that comparison see "unchanged", suppress the re-download, and
            // livelock the item re-conflicting on every push.
            items[result.key] = {
                ...existing,
                knownVer: result.current_ver ?? existing.knownVer,
                isDirty: true,
            }
        }
    }

    return { ...state, items, lastSyncedSeq }
}
