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
import {
    getBackupSyncManager,
    type BackupSyncManager,
} from '../sync/backupSyncManager'
import type { BackupReviewItemKind } from '../sync/busyItems'
import type {
    BackupActionOutcome,
    BackupBackUpOutcome,
    ContactImportSummary,
    ImportSummary,
    PasskeyImportSummary,
} from '../sync/types'

/** The three row actions an accounts, contacts or passkeys review screen
 *  offers. */
export type BackupReviewAction = 'backUp' | 'add' | 'delete'

export type { BackupReviewItemKind }

/** `deferred`: a back-up staged but cut off by a lock or stop, which the next
 *  sync sends. Not a failure, so the row must not say it was. */
export type BackupReviewActionResult = 'done' | 'deferred'

export type BackupReviewActionVariables = {
    action: BackupReviewAction
    /** Address for an account or contact, credential id for a passkey. */
    id: string
}

const UNAVAILABLE_MESSAGE = 'Backup is unavailable'
const NOT_BACKED_UP_MESSAGE = 'Backup did not complete'
const NOT_DELETED_MESSAGE = 'Delete did not complete'

const backUpItem = (
    manager: BackupSyncManager,
    kind: BackupReviewItemKind,
    id: string,
): Promise<BackupBackUpOutcome> => {
    switch (kind) {
        case 'account': {
            return manager.backUpAccount(id)
        }
        case 'contact': {
            return manager.backUpContact(id)
        }
        case 'passkey': {
            return manager.backUpPasskey(id)
        }
        default: {
            const exhaustive: never = kind
            return exhaustive
        }
    }
}

const addItemFromBackup = (
    manager: BackupSyncManager,
    kind: BackupReviewItemKind,
    id: string,
): Promise<
    ImportSummary | ContactImportSummary | PasskeyImportSummary | null
> => {
    switch (kind) {
        case 'account': {
            return manager.addAccountFromBackup(id)
        }
        case 'contact': {
            return manager.addContactFromBackup(id)
        }
        case 'passkey': {
            return manager.addPasskeyFromBackup(id)
        }
        default: {
            const exhaustive: never = kind
            return exhaustive
        }
    }
}

const deleteItemFromBackup = (
    manager: BackupSyncManager,
    kind: BackupReviewItemKind,
    id: string,
): Promise<BackupActionOutcome> => {
    switch (kind) {
        case 'account': {
            return manager.deleteAccountFromBackup(id)
        }
        case 'contact': {
            return manager.deleteContactFromBackup(id)
        }
        case 'passkey': {
            return manager.deletePasskeyFromBackup(id)
        }
        default: {
            const exhaustive: never = kind
            return exhaustive
        }
    }
}

const runReviewAction = async (
    kind: BackupReviewItemKind,
    { action, id }: BackupReviewActionVariables,
): Promise<BackupReviewActionResult> => {
    // Mutations run networkMode 'always', so offline every action still runs,
    // and both write paths then report a success they cannot have: a failed
    // sync is only a logged warning, a failed delete only a queued retry.
    assertOnline()

    const manager = getBackupSyncManager()

    switch (action) {
        case 'backUp': {
            const outcome = await backUpItem(manager, kind, id)
            if (outcome === 'deferred') return 'deferred'
            if (outcome !== 'settled') {
                throw new Error(NOT_BACKED_UP_MESSAGE)
            }
            return 'done'
        }
        case 'add': {
            const summary = await addItemFromBackup(manager, kind, id)
            if (summary === null) {
                throw new Error(UNAVAILABLE_MESSAGE)
            }
            if (summary.failed.length > 0) {
                throw new Error(summary.failed[0].reason)
            }
            return 'done'
        }
        case 'delete': {
            // Unlike the removal flows, the row reports a verdict on the
            // backup, so a queued retry is a failure here.
            const outcome = await deleteItemFromBackup(manager, kind, id)
            if (outcome !== 'settled') {
                throw new Error(NOT_DELETED_MESSAGE)
            }
            return 'done'
        }
        default: {
            const exhaustive: never = action
            return exhaustive
        }
    }
}

/**
 * Runs one review-screen row action against the sync manager. The toasts are
 * the caller's, supplied through `options`, so the copy stays with the screen
 * that owns it; busy rows come from the manager's published items.
 */
export const useBackupReviewActionMutation = (
    kind: BackupReviewItemKind,
    options?: UseMutationOptions<
        BackupReviewActionResult,
        Error,
        BackupReviewActionVariables
    >,
) =>
    useMutation({
        throwOnError: false,
        mutationFn: (variables: BackupReviewActionVariables) =>
            runReviewAction(kind, variables),
        ...options,
    })
