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

import { logger } from '@perawallet/wallet-core-shared'
import {
    batchUpsertItems,
    deleteItem,
    fetchDelta,
    fetchManifest,
    readItems,
} from '../api'
import { decryptItemPayload } from '../crypto/itemPayload'
import { type SyncState } from '../models'
import { applyDeltas } from './applyDeltas'
import { buildLocalItems } from './buildLocalItems'
import { pushDirty } from './pushDirty'
import { reconcile } from './reconcile'
import type { SyncEngineDeps } from './types'

const hasPendingWork = (state: SyncState): boolean =>
    Object.values(state.items).some(i => i.isDirty || i.pendingDelete)

/** Full pull + push. `now` is injected for deterministic tests. Throws on a hard
 *  network/transport failure (caller records FAILED + backs off); on success the
 *  returned state carries lastSyncResult = 'SUCCESS'. */
export const syncBackup = async (
    deps: SyncEngineDeps,
    state: SyncState,
    now: number = Date.now(),
): Promise<SyncState> => {
    // 1. Reconcile local first so the short-circuit below is accurate.
    const local = await buildLocalItems(
        deps.listAccounts(),
        deps.serializeAccount,
    )
    if (local.skipped > 0) {
        logger.warn('syncBackup: accounts skipped, deletions deferred', {
            skipped: local.skipped,
        })
    }
    let next = reconcile(state, local, now)

    // 2. Manifest short-circuit.
    const manifest = await fetchManifest(
        deps.network,
        deps.backupId,
        deps.deviceId,
    )
    if (
        manifest.backupGlobalHash === next.lastKnownBackupHash &&
        !hasPendingWork(next)
    ) {
        return { ...next, lastSyncedAt: now, lastSyncResult: 'SUCCESS' }
    }

    // 3-4. Fetch + apply remote deltas.
    const deltas = await fetchDelta(
        deps.network,
        deps.backupId,
        deps.deviceId,
        next.lastSyncedSeq,
    )
    next = await applyDeltas({
        state: next,
        deltas,
        deps: {
            network: deps.network,
            backupId: deps.backupId,
            deviceId: deps.deviceId,
            encryptionKey: deps.encryptionKey,
            importAccounts: deps.importAccounts,
            readItems,
            decrypt: decryptItemPayload,
        },
    })

    // 5. Push local changes (use the freshly-built local items).
    next = await pushDirty({
        state: next,
        localItems: local.items,
        deps: {
            network: deps.network,
            backupId: deps.backupId,
            deviceId: deps.deviceId,
            encryptionKey: deps.encryptionKey,
            batchUpsertItems,
            deleteItem,
        },
    })

    // 6. Advance pointers + mark success.
    return {
        ...next,
        lastKnownBackupHash: manifest.backupGlobalHash,
        lastSyncedSeq: Math.max(next.lastSyncedSeq, manifest.lastSeq),
        lastSyncedAt: now,
        lastSyncResult: 'SUCCESS',
    }
}
