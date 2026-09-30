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
    type BackupItemKey,
    type BackupSettings,
    SETTINGS_ITEM_ID,
    settingsItemKey,
    type SyncState,
} from '../models'
import type { ItemKeyHasher } from '../crypto/itemKeyHash'
import type { SyncEngineDeps } from './types'
import { observeLocalSettings, settingsDocumentHash } from './settingsDocument'

/** Separate from `reconcile`, whose whole-payload hash would let one device's
 *  currency change overwrite another's language change. */
export const reconcileSettings = (
    state: SyncState,
    key: BackupItemKey,
    local: BackupSettings,
    now: number,
): SyncState => {
    const tracked = state.items[key]
    if (tracked?.status === BackupItemStatus.IGNORED) return state

    const { doc, hasChanged } = observeLocalSettings(
        tracked?.settingsFields,
        local,
        now,
    )
    const localContentHash = settingsDocumentHash(doc)

    return {
        ...state,
        items: {
            ...state.items,
            [key]: tracked
                ? {
                      ...tracked,
                      isDirty: tracked.isDirty || hasChanged,
                      localContentHash,
                      settingsFields: doc,
                  }
                : {
                      type: BackupItemType.SETTINGS,
                      knownVer: 0,
                      baseVer: 0,
                      isDirty: true,
                      status: BackupItemStatus.ACTIVE,
                      lastRemoteHash: null,
                      localContentHash,
                      localUpdatedAt: null,
                      settingsFields: doc,
                  },
        },
    }
}

export const reconcileLocalSettings = (
    state: SyncState,
    deps: Pick<SyncEngineDeps, 'getSettings'> & { hashAddress: ItemKeyHasher },
    now: number,
): SyncState =>
    reconcileSettings(
        state,
        settingsItemKey(deps.hashAddress(SETTINGS_ITEM_ID)),
        deps.getSettings(),
        now,
    )
