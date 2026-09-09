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
import { fetchDelta, isFromSeqTooOldError } from '../api'
import {
    BackupItemStatus,
    DeltaOperation,
    type DeltaEntry,
    type Manifest,
    type SyncState,
} from '../models'
import type { SyncEngineDeps } from './types'

/**
 * The manifest replayed as deltas, for when the changelog window that would
 * have carried them has been pruned. Feeding it through `applyDeltas` rather
 * than reseeding the sync state is deliberate: this device's own decisions — a
 * held import, an account it deleted — live in the state and would be undone by
 * a reset.
 *
 * A tracked key the manifest no longer lists was deleted on the server, late
 * enough that its DELETE entry is pruned too. `knownVer > 0` is what separates
 * that from a local item still waiting for its first push: the server has never
 * seen that one, and marking it deleted would drop it from the backup silently.
 */
export const rebuildDeltasFromManifest = (
    manifest: Manifest,
    state: SyncState,
): DeltaEntry[] => [
    ...Object.entries(manifest.items).map(([key, item]) => ({
        seq: item.lastSeq,
        key,
        type: item.type,
        ver: item.ver,
        status: item.status,
        op: DeltaOperation.UPSERT,
        hash: item.hash,
    })),
    ...Object.entries(state.items)
        .filter(
            ([key, item]) =>
                !Object.hasOwn(manifest.items, key) && item.knownVer > 0,
        )
        .map(([key, item]) => ({
            seq: manifest.lastSeq,
            key,
            type: item.type,
            ver: item.knownVer,
            status: BackupItemStatus.IGNORED,
            op: DeltaOperation.DELETE,
            hash: null,
        })),
]

/**
 * Deltas from the cursor, or — when retention has pruned past that cursor — the
 * manifest replayed as deltas, together with the seq it is current through.
 * That seq is the only thing that can move the cursor over the pruned gap; it
 * is 0 on the ordinary path, where `applyDeltas` advances the cursor itself.
 *
 * `getManifest` is a callback so the caller decides where the manifest comes
 * from: `syncBackup` already holds one, and null there means the backup is
 * empty rather than unfetched, which is not something to rebuild from.
 */
export const fetchDeltaOrRebuild = async (
    deps: Pick<SyncEngineDeps, 'network' | 'backupId' | 'deviceId'>,
    state: SyncState,
    getManifest: () => Promise<Manifest | null>,
): Promise<{ deltas: DeltaEntry[]; rebuiltThroughSeq: number }> => {
    try {
        const deltas = await fetchDelta(
            deps.network,
            deps.backupId,
            deps.deviceId,
            state.lastSyncedSeq,
        )
        return { deltas, rebuiltThroughSeq: 0 }
    } catch (error) {
        if (!isFromSeqTooOldError(error)) throw error
        const manifest = await getManifest()
        if (manifest === null) throw error
        logger.warn('backup sync: changelog pruned, rebuilding from manifest', {
            fromSeq: state.lastSyncedSeq,
            manifestSeq: manifest.lastSeq,
        })
        return {
            deltas: rebuildDeltasFromManifest(manifest, state),
            rebuiltThroughSeq: manifest.lastSeq,
        }
    }
}
