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
import { parseContactPayload } from '../api/payloadParsers'
import type {
    BackupItemKey,
    ContactBackupPayload,
    FetchedItem,
    SyncItemState,
} from '../models'
import {
    adoptRemote,
    decryptItem,
    isLocalNewer,
    keepLocalEdit,
    type CollectPayloadsDeps,
} from './collectPayloads'

/** `items` is mutated in place. Returns the contacts to import — a contact held
 *  for review is decrypted but deliberately left out. */
export const collectContactPayloads = ({
    fetched,
    items,
    deps,
}: {
    fetched: FetchedItem[]
    items: Record<BackupItemKey, SyncItemState>
    deps: CollectPayloadsDeps
}): ContactBackupPayload[] => {
    const toImport: ContactBackupPayload[] = []

    for (const item of fetched) {
        const plaintext = decryptItem(item, deps)
        if (plaintext === null) continue

        const existing = items[item.key]
        if (existing && isLocalNewer(existing, plaintext)) {
            items[item.key] = keepLocalEdit(existing, item)
            continue
        }

        let payload: ContactBackupPayload
        try {
            payload = parseContactPayload(plaintext)
        } catch {
            logger.warn('collectContactPayloads: failed to parse', {
                key: item.key,
            })
            continue
        }

        // Held for review: cache the name so the row can render it, but do not
        // import — the user deleted this contact here on purpose. Downloading
        // it at all is only safe because the payload holds no secret.
        if (existing?.pendingImport === true) {
            items[item.key] = {
                ...existing,
                knownVer: item.ver,
                baseVer: item.ver,
                lastRemoteHash: item.hash,
                label: payload.name,
            }
            continue
        }

        toImport.push(payload)
        items[item.key] = {
            ...adoptRemote(items[item.key] as SyncItemState, item, plaintext),
            label: payload.name,
        }
    }

    return toImport
}
