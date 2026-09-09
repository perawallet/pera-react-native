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
import { getBackupSyncManager } from '../sync/backupSyncManager'

/** The three row actions an accounts or contacts review screen offers. */
export type BackupReviewAction = 'backUp' | 'add' | 'delete'

export type BackupReviewItemKind = 'account' | 'contact'

export type BackupReviewActionVariables = {
    action: BackupReviewAction
    address: string
}

/** The manager refuses a review action while a sync run holds the lock, and
 *  says so by returning false/null rather than throwing. */
const BUSY_MESSAGE = 'Backup is busy syncing'

const runReviewAction = async (
    kind: BackupReviewItemKind,
    { action, address }: BackupReviewActionVariables,
): Promise<void> => {
    const manager = getBackupSyncManager()
    const isAccount = kind === 'account'

    switch (action) {
        case 'backUp': {
            const settled = isAccount
                ? await manager.backUpAccount(address)
                : await manager.backUpContact(address)
            if (!settled) {
                throw new Error(BUSY_MESSAGE)
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
            const settled = isAccount
                ? await manager.deleteAccountFromBackup(address)
                : await manager.deleteContactFromBackup(address)
            if (!settled) {
                throw new Error(BUSY_MESSAGE)
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
