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

import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { assertOnline } from '@perawallet/wallet-core-shared'
import { getBackupSyncManager } from '../sync/backupSyncManager'

/** The three row actions an accounts or contacts review screen offers. */
export type BackupReviewAction = 'backUp' | 'add' | 'delete'

export type BackupReviewItemKind = 'account' | 'contact'

export type BackupReviewActionVariables = {
    action: BackupReviewAction
    address: string
}

const BUSY_MESSAGE = 'Backup is busy syncing'
const NOT_BACKED_UP_MESSAGE = 'Backup did not complete'
const NOT_DELETED_MESSAGE = 'Delete did not complete'

const runReviewAction = async (
    kind: BackupReviewItemKind,
    { action, address }: BackupReviewActionVariables,
): Promise<void> => {
    // Mutations run networkMode 'always', so offline every action still runs,
    // and both write paths then report a success they cannot have: a failed
    // sync is only a logged warning, a failed delete only a queued retry.
    assertOnline()

    const manager = getBackupSyncManager()
    const isAccount = kind === 'account'

    switch (action) {
        case 'backUp': {
            const settled = isAccount
                ? await manager.backUpAccount(address)
                : await manager.backUpContact(address)
            if (!settled) {
                throw new Error(NOT_BACKED_UP_MESSAGE)
            }
            break
        }
        case 'add': {
            const summary = isAccount
                ? await manager.addAccountFromBackup(address)
                : await manager.addContactFromBackup(address)
            if (summary == null) {
                throw new Error(BUSY_MESSAGE)
            }
            if (summary.failed.length > 0) {
                throw new Error(summary.failed[0].reason)
            }
            break
        }
        case 'delete': {
            // Unlike the removal flows, the row reports a verdict on the
            // backup, so a queued retry is a failure here.
            const outcome = isAccount
                ? await manager.deleteAccountFromBackup(address)
                : await manager.deleteContactFromBackup(address)
            if (outcome !== 'settled') {
                throw new Error(NOT_DELETED_MESSAGE)
            }
            break
        }
    }
}

/**
 * Runs one review-screen row action against the sync manager. The busy-row
 * state and the toasts are the caller's, supplied through `options`, so the
 * copy stays with the screen that owns it.
 */
export const useBackupReviewActionMutation = (
    kind: BackupReviewItemKind,
    options?: UseMutationOptions<void, Error, BackupReviewActionVariables>,
) =>
    useMutation({
        throwOnError: false,
        mutationFn: (variables: BackupReviewActionVariables) =>
            runReviewAction(kind, variables),
        ...options,
    })
