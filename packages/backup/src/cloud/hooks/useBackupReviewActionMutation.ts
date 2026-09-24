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

/** The three row actions an accounts, contacts or passkeys review screen
 *  offers. */
export type BackupReviewAction = 'backUp' | 'add' | 'delete'

export type BackupReviewItemKind = 'account' | 'contact' | 'passkey'

export type BackupReviewActionVariables = {
    action: BackupReviewAction
    /** Address for an account or contact, credential id for a passkey. */
    id: string
}

const BUSY_MESSAGE = 'Backup is busy syncing'
const NOT_BACKED_UP_MESSAGE = 'Backup did not complete'
const NOT_DELETED_MESSAGE = 'Delete did not complete'

const runReviewAction = async (
    kind: BackupReviewItemKind,
    { action, id }: BackupReviewActionVariables,
): Promise<void> => {
    // Mutations run networkMode 'always', so offline every action still runs,
    // and both write paths then report a success they cannot have: a failed
    // sync is only a logged warning, a failed delete only a queued retry.
    assertOnline()

    const manager = getBackupSyncManager()

    switch (action) {
        case 'backUp': {
            const settled =
                kind === 'account'
                    ? await manager.backUpAccount(id)
                    : kind === 'contact'
                      ? await manager.backUpContact(id)
                      : await manager.backUpPasskey(id)
            if (!settled) {
                throw new Error(NOT_BACKED_UP_MESSAGE)
            }
            break
        }
        case 'add': {
            const summary =
                kind === 'account'
                    ? await manager.addAccountFromBackup(id)
                    : kind === 'contact'
                      ? await manager.addContactFromBackup(id)
                      : await manager.addPasskeyFromBackup(id)
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
            const outcome =
                kind === 'account'
                    ? await manager.deleteAccountFromBackup(id)
                    : kind === 'contact'
                      ? await manager.deleteContactFromBackup(id)
                      : await manager.deletePasskeyFromBackup(id)
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
