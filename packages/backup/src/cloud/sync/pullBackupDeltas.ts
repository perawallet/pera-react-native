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

import { fetchDelta, readItems } from '../api'
import { decryptItemPayload } from '../crypto/itemPayload'
import type { SyncState } from '../models'
import { applyDeltas } from './applyDeltas'
import type { SyncEngineDeps } from './types'

/** WebSocket-triggered lightweight pull: fetch deltas from the local cursor and
 *  apply them (download/decrypt/import remote changes). No reconcile, no push —
 *  that's `syncBackup`'s job on the periodic/foreground cycle. `now` is injected
 *  for deterministic tests. */
export const pullBackupDeltas = async (
    deps: Pick<
        SyncEngineDeps,
        'network' | 'backupId' | 'deviceId' | 'encryptionKey' | 'importAccounts'
    >,
    state: SyncState,
    now: number = Date.now(),
): Promise<SyncState> => {
    const deltas = await fetchDelta(
        deps.network,
        deps.backupId,
        deps.deviceId,
        state.lastSyncedSeq,
    )
    const next = await applyDeltas({
        state,
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

    // A device that only ever receives over the socket never runs `syncBackup`,
    // so without this it reads as never-synced with a full account list.
    return { ...next, lastSyncedAt: now, lastSyncResult: 'SUCCESS' }
}
