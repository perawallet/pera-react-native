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

import { accountAddressFromItemKey, accountItemKey } from './itemKeys'
import type { SyncItemState, SyncState } from './syncState'
import { BackupItemStatus } from './types'

export type BackupAccountReview = {
    backedUp: Set<string>
    notBackedUp: string[]
    /** Addresses live in the backup that this device deliberately deleted;
     *  each awaits an Add or a delete-from-cloud. */
    availableFromBackup: string[]
}

/** Whether the backup holds this item, from the device's point of view. The
 *  single definition — `knownVer` is the upload test, because reconcile marks a
 *  new local account ACTIVE before it has ever been sent, so status alone would
 *  show an account the server has never seen as backed up. */
export const isLiveInBackup = (item: SyncItemState): boolean =>
    item.status === BackupItemStatus.ACTIVE &&
    item.knownVer > 0 &&
    item.pendingDelete !== true

/** Reads address records only: a secret-bearing account also stores key
 *  material under the same item type, so counting every ACCOUNT item would
 *  double it. */
export const deriveBackupAccountReview = (
    syncState: SyncState | null,
    localAddresses: readonly string[],
): BackupAccountReview => {
    const backedUp = new Set<string>()
    const availableFromBackup: string[] = []

    for (const [key, item] of Object.entries(syncState?.items ?? {})) {
        const address = accountAddressFromItemKey(key)
        if (address === null || !isLiveInBackup(item)) continue

        if (item.pendingImport === true) availableFromBackup.push(address)
        else backedUp.add(address)
    }

    const local = new Set(localAddresses)
    return {
        // An address held both locally and in the backup is not awaiting
        // review, whatever the sync state still says.
        backedUp: new Set([...backedUp].filter(address => local.has(address))),
        notBackedUp: localAddresses.filter(address => !backedUp.has(address)),
        availableFromBackup: availableFromBackup.filter(
            address => !local.has(address),
        ),
    }
}

/** For callers that already hold the account: `deriveBackupAccountReview`
 *  intersects with the wallet's addresses, which such a caller satisfies by
 *  construction. */
export const isAddressBackedUp = (
    syncState: SyncState | null,
    address: string,
): boolean => {
    const item = syncState?.items[accountItemKey(address)]
    return item != null && isLiveInBackup(item) && item.pendingImport !== true
}
