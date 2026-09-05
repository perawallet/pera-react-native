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

import { isLiveInBackup } from './reviewBuckets'
import type { SyncState } from './syncState'
import { BackupItemType } from './types'

/** Accounts are counted by `deriveBackupAccountReview`, which needs the
 *  wallet's addresses to tell a backed-up account from one only the backup
 *  holds. Contacts have no such split, so they are counted here. */
export const deriveBackupContactsInSync = (
    syncState: SyncState | null,
): number => {
    let contactsInSync = 0

    for (const item of Object.values(syncState?.items ?? {})) {
        if (item.type === BackupItemType.CONTACT && isLiveInBackup(item)) {
            contactsInSync += 1
        }
    }

    return contactsInSync
}
