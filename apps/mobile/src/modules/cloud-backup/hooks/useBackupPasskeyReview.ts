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

import { useCallback, useMemo, useState } from 'react'
import {
    deriveBackupPasskeyReview,
    useBackupReviewActionMutation,
    useBackupSyncStateStore,
    type BackupPasskey,
    type BackupPasskeyReview,
    type BackupReviewAction,
} from '@perawallet/wallet-core-backup'
import { NoConnectionError, logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useErrorToast } from '@hooks/useErrorToast'
import { useProvenPasskeysQuery } from './useProvenPasskeysQuery'

export type UseBackupPasskeyReviewResult = {
    passkeys: BackupPasskey[]
    backedUpPasskeys: BackupPasskey[]
    notBackedUpPasskeys: BackupPasskey[]
    /** Credentials the backup holds that this device deleted, with the label
     *  cached when they were pulled. */
    availableFromBackup: BackupPasskeyReview['availableFromBackup']
    isBackedUp: (credentialId: string) => boolean
    isLoading: boolean
    busyCredentialId: string | null
    backUpPasskey: (credentialId: string) => void
    addFromBackup: (credentialId: string) => void
    deleteFromBackup: (credentialId: string) => void
}

const TOAST_KEY: Record<
    BackupReviewAction,
    { success: string; error: string }
> = {
    backUp: {
        success: 'cloud_backup.passkeys.back_up_success',
        error: 'cloud_backup.passkeys.back_up_error',
    },
    add: {
        success: 'cloud_backup.passkeys.add_success',
        error: 'cloud_backup.passkeys.add_error',
    },
    delete: {
        success: 'cloud_backup.passkeys.delete_success',
        error: 'cloud_backup.passkeys.delete_error',
    },
}

export const useBackupPasskeyReview = (): UseBackupPasskeyReviewResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const [busyCredentialId, setBusyCredentialId] = useState<string | null>(
        null,
    )
    const { passkeys, isLoading } = useProvenPasskeysQuery()
    const syncState = useBackupSyncStateStore(state => state.syncState)

    // Only a credential this device has proven it can re-derive is offered for
    // review: the rest can never be restored, so backing them up would promise
    // something the restore path cannot keep.
    const credentialIds = useMemo(
        () => passkeys.map(passkey => passkey.credentialId),
        [passkeys],
    )

    const review = useMemo(
        () => deriveBackupPasskeyReview(syncState, credentialIds),
        [syncState, credentialIds],
    )

    const { mutate } = useBackupReviewActionMutation('passkey', {
        onMutate: ({ id }) => setBusyCredentialId(id),
        onSuccess: (_result, { action }) => {
            showToast({
                title: t(TOAST_KEY[action].success),
                body: '',
                type: 'success',
            })
        },
        onError: (error, { action, id }) => {
            logger.warn('useBackupPasskeyReview: review action failed', {
                action,
                credentialId: id,
                error: error instanceof Error ? error.message : String(error),
            })
            if (error instanceof NoConnectionError) {
                showError(error)
                return
            }
            showToast({
                title: t(TOAST_KEY[action].error),
                body: '',
                type: 'error',
            })
        },
        onSettled: () => setBusyCredentialId(null),
    })

    const notBackedUpIds = useMemo(
        () => new Set(review.notBackedUp),
        [review.notBackedUp],
    )

    return {
        passkeys,
        backedUpPasskeys: useMemo(
            () => passkeys.filter(p => review.backedUp.has(p.credentialId)),
            [passkeys, review.backedUp],
        ),
        notBackedUpPasskeys: useMemo(
            () => passkeys.filter(p => notBackedUpIds.has(p.credentialId)),
            [passkeys, notBackedUpIds],
        ),
        availableFromBackup: review.availableFromBackup,
        isBackedUp: useCallback(
            (credentialId: string) => review.backedUp.has(credentialId),
            [review.backedUp],
        ),
        isLoading,
        busyCredentialId,
        backUpPasskey: useCallback(
            (credentialId: string) =>
                mutate({ action: 'backUp', id: credentialId }),
            [mutate],
        ),
        addFromBackup: useCallback(
            (credentialId: string) =>
                mutate({ action: 'add', id: credentialId }),
            [mutate],
        ),
        deleteFromBackup: useCallback(
            (credentialId: string) =>
                mutate({ action: 'delete', id: credentialId }),
            [mutate],
        ),
    }
}
