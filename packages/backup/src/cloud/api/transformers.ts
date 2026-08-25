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
import type { DeltaEntry, FetchedItem, Manifest, ManifestItem } from '../models'
import { ItemReadStatus, readItemEntrySchema } from './types'
import type {
    DeltaEntryResponse,
    ManifestItemResponse,
    ManifestResponse,
} from './types'

const transformManifestItem = (item: ManifestItemResponse): ManifestItem => ({
    type: item.type,
    ver: item.ver,
    status: item.status,
    hash: item.hash,
    lastSeq: item.last_seq,
})

export const transformManifest = (response: ManifestResponse): Manifest => ({
    backupId: response.backup_id,
    backupGlobalHash: response.backup_global_hash,
    globalVersion: response.global_version,
    lastSeq: response.last_seq,
    generatedAt: response.generated_at,
    items: Object.fromEntries(
        Object.entries(response.items).map(([key, item]) => [
            key,
            transformManifestItem(item),
        ]),
    ),
})

export const transformDeltaEntry = (entry: DeltaEntryResponse): DeltaEntry => ({
    seq: entry.seq,
    key: entry.key,
    type: entry.type,
    ver: entry.ver,
    status: entry.status,
    op: entry.op,
    hash: entry.hash,
})

export const transformDeltaEntries = (
    entries: DeltaEntryResponse[],
): DeltaEntry[] => entries.map(transformDeltaEntry)

/** Per-entry validation: a dropped item is just not restored this round, and
 *  advances no delta pointer, so the next sync retries it. */
export const transformReadItems = (entries: unknown[]): FetchedItem[] => {
    const items: FetchedItem[] = []
    for (const raw of entries) {
        const parsed = readItemEntrySchema.safeParse(raw)
        if (!parsed.success) {
            logger.warn('transformReadItems: discarded malformed entry', {
                issue: parsed.error.issues[0]?.message,
            })
            continue
        }
        const entry = parsed.data
        if (entry.status !== ItemReadStatus.FOUND) continue
        items.push({
            key: entry.key,
            payload: entry.payload,
            hash: entry.hash,
            ver: entry.ver,
        })
    }
    return items
}
