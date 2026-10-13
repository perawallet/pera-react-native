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
import { parseSettingsPayload } from '../api/payloadParsers'
import type {
    BackupItemKey,
    BackupSettings,
    FetchedItem,
    SettingsBackupPayload,
    SyncItemState,
} from '../models'
import { decryptItem, type CollectPayloadsDeps } from './collectPayloads'
import { mergeRemoteSettings, settingsDocumentHash } from './settingsDocument'

/** `items` is mutated in place. Merges per field rather than adopting the
 *  remote wholesale; a later local edit wins and leaves the item dirty. */
export const collectSettingsPayloads = ({
    fetched,
    items,
    deps,
}: {
    fetched: FetchedItem[]
    items: Record<BackupItemKey, SyncItemState>
    deps: CollectPayloadsDeps
}): Partial<BackupSettings> => {
    let toApply: Partial<BackupSettings> = {}

    for (const item of fetched) {
        const plaintext = decryptItem(item, deps)
        if (plaintext === null) continue

        let payload: SettingsBackupPayload
        try {
            payload = parseSettingsPayload(plaintext)
        } catch {
            logger.warn('collectSettingsPayloads: failed to parse', {
                key: item.key,
            })
            continue
        }

        const existing = items[item.key] as SyncItemState
        const merged = mergeRemoteSettings(existing.settingsFields, payload)
        items[item.key] = {
            ...existing,
            knownVer: item.ver,
            baseVer: item.ver,
            lastRemoteHash: item.hash,
            isDirty: merged.isRemoteBehind,
            localContentHash: settingsDocumentHash(merged.doc),
            settingsFields: merged.doc,
        }
        toApply = { ...toApply, ...merged.toApply }
    }

    return toApply
}
