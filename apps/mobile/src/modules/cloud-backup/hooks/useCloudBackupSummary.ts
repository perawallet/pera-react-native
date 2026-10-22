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

import { useMemo } from 'react'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    accountBackupAddresses,
    deriveBackupAccountReview,
    useBackupSyncStateStore,
    useCloudBackupStore,
    type SyncState,
} from '@perawallet/wallet-core-backup'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useIsCloudBackupAvailable } from '@hooks/useIsCloudBackupAvailable'
import { backupAccountsOf } from '../utils/backupAddress'

/** `lastSyncedAt` is epoch milliseconds of the last successful sync. */
export type CloudBackupSummary =
    | { state: 'unavailable' }
    | { state: 'notSetUp' }
    | { state: 'failed'; lastSyncedAt: Nullable<number> }
    | {
          state: 'partial'
          notBackedUpCount: number
          lastSyncedAt: Nullable<number>
      }
    | { state: 'backedUp'; lastSyncedAt: Nullable<number> }

type DeriveCloudBackupSummaryParams = {
    isAvailable: boolean
    isConfigured: boolean
    syncState: Nullable<SyncState>
    /** Each local account's backup addresses, as the overview screen reads them. */
    accountAddresses: readonly (readonly string[])[]
}

// A failed sync outranks missing accounts: until syncing works again, backing
// up the missing ones can't succeed either.
export const deriveCloudBackupSummary = ({
    isAvailable,
    isConfigured,
    syncState,
    accountAddresses,
}: DeriveCloudBackupSummaryParams): CloudBackupSummary => {
    if (!isAvailable) return { state: 'unavailable' }
    if (!isConfigured) return { state: 'notSetUp' }

    const lastSyncedAt = syncState?.lastSyncedAt ?? null
    if (syncState?.lastSyncResult === 'FAILED') {
        return { state: 'failed', lastSyncedAt }
    }

    const { notBackedUp } = deriveBackupAccountReview(
        syncState,
        accountAddresses,
    )
    return notBackedUp.length > 0
        ? {
              state: 'partial',
              notBackedUpCount: notBackedUp.length,
              lastSyncedAt,
          }
        : { state: 'backedUp', lastSyncedAt }
}

/** Cloud backup's state in one value, for surfaces outside its own screens. */
export const useCloudBackupSummary = (): CloudBackupSummary => {
    const isAvailable = useIsCloudBackupAvailable()
    const isConfigured = useCloudBackupStore(state => state.isConfigured())
    const syncState = useBackupSyncStateStore(state => state.syncState)
    const accounts = useAccountsStore(state => state.accounts)

    const accountAddresses = useMemo(
        () =>
            backupAccountsOf(accounts).map(({ account }) =>
                accountBackupAddresses(account),
            ),
        [accounts],
    )

    return useMemo(
        () =>
            deriveCloudBackupSummary({
                isAvailable,
                isConfigured,
                syncState,
                accountAddresses,
            }),
        [isAvailable, isConfigured, syncState, accountAddresses],
    )
}
