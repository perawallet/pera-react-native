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

import { isAccountItemKey } from './itemKeys'
import type { SyncItemState, SyncState } from './syncState'
import { BackupItemStatus, BackupItemType } from './types'

export type BackupSyncCounts = {
    accountsInSync: number
    contactsInSync: number
}

/** A locally deleted account keeps its ACTIVE status until the server confirms
 *  the delete. */
const isBackedUp = (item: SyncItemState): boolean =>
    item.status === BackupItemStatus.ACTIVE && item.pendingDelete !== true

/** Counts address records rather than ACCOUNT-typed items: a secret-bearing
 *  account stores its key material under that same type, so counting by type
 *  reports every such account twice. */
export const deriveBackupSyncCounts = (
    syncState: SyncState | null,
): BackupSyncCounts => {
    let accountsInSync = 0
    let contactsInSync = 0

    if (syncState != null) {
        for (const [key, item] of Object.entries(syncState.items)) {
            if (!isBackedUp(item)) continue

            switch (item.type) {
                case BackupItemType.ACCOUNT: {
                    if (isAccountItemKey(key)) accountsInSync += 1
                    break
                }
                case BackupItemType.CONTACT: {
                    contactsInSync += 1
                    break
                }
            }
        }
    }

    return { accountsInSync, contactsInSync }
}
