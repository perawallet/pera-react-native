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

import { isNotFoundError, logger } from '@perawallet/wallet-core-shared'
import {
    batchUpsertItems,
    deleteItem,
    fetchDelta,
    fetchManifest,
    readItems,
} from '../api'
import { decryptItemPayload } from '../crypto/itemPayload'
import { type Manifest, type SyncState } from '../models'
import { applyDeltas } from './applyDeltas'
import { buildLocalItems } from './buildLocalItems'
import { pushDirty } from './pushDirty'
import { reconcile } from './reconcile'
import type { SyncEngineDeps } from './types'

const hasPendingWork = (state: SyncState): boolean =>
    Object.values(state.items).some(i => i.isDirty || i.pendingDelete)

/** A registered backup has no manifest until its first item lands, so the very
 *  first sync of a new backup 404s. Destroying a backup drops its auth key, so
 *  a wiped backup fails with 401 instead — a 404 can only mean "still empty".
 *  Warns because that is only true once: a 404 that keeps coming back leaves
 *  `lastKnownBackupHash` pinned, which silently disables the short-circuit
 *  below and makes every sync a full delta + read + push. */
const fetchManifestOrNull = async (
    deps: SyncEngineDeps,
): Promise<Manifest | null> => {
    try {
        return await fetchManifest(deps.network, deps.backupId, deps.deviceId)
    } catch (error) {
        if (!isNotFoundError(error)) throw error
        logger.warn('syncBackup: no manifest, treating backup as empty')
        return null
    }
}

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
    const manifest = await fetchManifestOrNull(deps)
    if (
        manifest !== null &&
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
        lastKnownBackupHash:
            manifest?.backupGlobalHash ?? next.lastKnownBackupHash,
        lastSyncedSeq: Math.max(next.lastSyncedSeq, manifest?.lastSeq ?? 0),
        lastSyncedAt: now,
        lastSyncResult: 'SUCCESS',
    }
}
