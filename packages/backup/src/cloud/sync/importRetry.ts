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
    BACKUP_SECRETS_KEY_PREFIX,
    isAccountKey,
    type BackupItemKey,
    type SyncItemState,
} from '../models'
import type { ImportSummary } from './types'

/** Corrupt data or an import this client can't do fails the same way on every
 *  sync, so the re-read stops here until a chain becomes readable or the item
 *  changes remotely. */
export const MAX_IMPORT_ATTEMPTS = 3

export const isImportRetryDue = (item: SyncItemState): boolean => {
    const failures = item.importFailures ?? 0
    return failures > 0 && failures < MAX_IMPORT_ATTEMPTS
}

/** `items` is mutated in place. A failed item is left unread, which is what
 *  sends it back through the next sync's read; a success clears the count.
 *  Only account and secrets keys count: a contact can share a failed address. */
export const recordImportResults = (
    items: Record<BackupItemKey, SyncItemState>,
    keys: Iterable<BackupItemKey>,
    failed: ImportSummary['failed'],
): void => {
    const failedAddresses = new Set(failed.map(failure => failure.address))
    for (const key of keys) {
        if (!isAccountKey(key) && !key.startsWith(BACKUP_SECRETS_KEY_PREFIX))
            continue
        const item = items[key]
        if (!item?.address) continue
        // A record fails when any of its chains does.
        const addresses = item.addresses ?? [item.address]
        if (addresses.some(address => failedAddresses.has(address))) {
            items[key] = {
                ...item,
                localContentHash: null,
                importFailures: (item.importFailures ?? 0) + 1,
            }
        } else if (item.importFailures !== undefined) {
            const { importFailures: _, ...succeeded } = item
            items[key] = succeeded
        }
    }
}
