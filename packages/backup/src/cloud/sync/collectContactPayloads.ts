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
    parseContactPayload,
    parseContactRecordPayload,
} from '../api/payloadParsers'
import {
    isContactRecordKey,
    isContactRecordReadable,
    type BackupItemKey,
    type ContactBackupPayload,
    type ContactRecordPayload,
    type FetchedItem,
    type SyncItemState,
} from '../models'
import { buildPulledContacts, contactRecordIdentifiers } from '../restore'
import {
    adoptRemote,
    decryptItem,
    isLocalNewer,
    keepLocalEdit,
    seenOnly,
    type CollectPayloadsDeps,
} from './collectPayloads'
import type { PulledContact } from './types'

/** `items` is mutated in place. Returns the contacts to import: a contact held
 *  for review is decrypted but deliberately left out, and so is a record only
 *  a newer client can read. */
export const collectContactPayloads = ({
    fetched,
    items,
    deps,
}: {
    fetched: FetchedItem[]
    items: Record<BackupItemKey, SyncItemState>
    deps: CollectPayloadsDeps
}): PulledContact[] => {
    const records: ContactRecordPayload[] = []
    const legacy: ContactBackupPayload[] = []

    for (const item of fetched) {
        const plaintext = decryptItem(item, deps)
        if (plaintext === null) continue

        const existing = items[item.key]
        const isRecord = isContactRecordKey(item.key)
        if (!isRecord && existing && isLocalNewer(existing, plaintext)) {
            items[item.key] = keepLocalEdit(existing, item)
            continue
        }

        let payload: ContactBackupPayload | ContactRecordPayload
        try {
            payload = isRecord
                ? parseContactRecordPayload(plaintext)
                : parseContactPayload(plaintext)
        } catch {
            logger.warn('collectContactPayloads: failed to parse', {
                key: item.key,
            })
            continue
        }

        if ('addresses' in payload) {
            const identifiers = contactRecordIdentifiers(payload)
            // A newer client's record: tracked, never imported or overwritten,
            // so a local edit waiting to push is dropped.
            if (!isContactRecordReadable(payload)) {
                items[item.key] = {
                    ...seenOnly(existing, item, identifiers),
                    isDirty: false,
                }
                continue
            }
            // The remote content is still cached, so the edit's push keeps
            // what it added.
            if (existing && isLocalNewer(existing, plaintext)) {
                items[item.key] = {
                    ...keepLocalEdit(existing, item),
                    ...identifiers,
                }
                continue
            }
            // Held for review: cache the name so the row can render it, but do
            // not import, since the user deleted this contact here on purpose.
            if (existing?.pendingImport === true) {
                items[item.key] = seenOnly(existing, item, identifiers)
                continue
            }
            records.push(payload)
            items[item.key] = {
                ...adoptRemote(existing as SyncItemState, item, plaintext),
                ...identifiers,
            }
            continue
        }

        // Downloading a held item at all is only safe because the payload
        // holds no secret.
        if (existing?.pendingImport === true) {
            items[item.key] = {
                ...existing,
                knownVer: item.ver,
                baseVer: item.ver,
                lastRemoteHash: item.hash,
                label: payload.name,
                address: payload.address,
            }
            continue
        }

        legacy.push(payload)
        items[item.key] = {
            ...adoptRemote(items[item.key] as SyncItemState, item, plaintext),
            label: payload.name,
            address: payload.address,
        }
    }

    return buildPulledContacts({ records, legacy })
}
