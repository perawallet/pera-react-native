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

import { useCallback, useMemo } from 'react'
import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import {
    contactBackupAddresses,
    deriveBackupContactReview,
    backupBusyItemKey,
    useBackupReviewActionMutation,
    useBackupSyncActivityStore,
    useBackupSyncStateStore,
    type BackupContactReview,
    type BackupReviewAction,
} from '@perawallet/wallet-core-backup'
import { NoConnectionError, logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useErrorToast } from '@hooks/useErrorToast'

/** `backupAddress` is the contact's first address, which names its record. */
export type BackupContact = Contact & { backupAddress: string }

export type UseBackupContactReviewResult = {
    contacts: BackupContact[]
    backedUpContacts: BackupContact[]
    notBackedUpContacts: BackupContact[]
    /** Contacts the backup holds that this device deleted, with their names. */
    availableFromBackup: BackupContactReview['availableFromBackup']
    isBackedUp: (address: string) => boolean
    /** True while a review action on this row is queued or running, even
     *  one started before the screen was last opened. */
    isBusy: (address: string) => boolean
    backUpContact: (address: string) => void
    addFromBackup: (address: string) => void
    deleteFromBackup: (address: string) => void
}

const TOAST_KEY: Record<
    BackupReviewAction,
    { success: string; error: string }
> = {
    backUp: {
        success: 'cloud_backup.contacts.back_up_success',
        error: 'cloud_backup.contacts.back_up_error',
    },
    add: {
        success: 'cloud_backup.contacts.add_success',
        error: 'cloud_backup.contacts.add_error',
    },
    delete: {
        success: 'cloud_backup.contacts.delete_success',
        error: 'cloud_backup.contacts.delete_error',
    },
}

export const useBackupContactReview = (): UseBackupContactReviewResult => {
    const { t } = useLanguage()
    const { showToast } = useToast()
    const { showError } = useErrorToast()
    const busyItems = useBackupSyncActivityStore(state => state.busyItems)
    const storedContacts = useContactsStore(state => state.contacts)
    const contacts = useMemo(
        () =>
            storedContacts.flatMap(contact => {
                const [backupAddress] = contactBackupAddresses(contact)
                return backupAddress === undefined
                    ? []
                    : [{ ...contact, backupAddress }]
            }),
        [storedContacts],
    )
    const syncState = useBackupSyncStateStore(state => state.syncState)

    const review = useMemo(
        () =>
            deriveBackupContactReview(
                syncState,
                storedContacts.map(contactBackupAddresses),
            ),
        [syncState, storedContacts],
    )

    const { mutate } = useBackupReviewActionMutation('contact', {
        onSuccess: (result, { action }) => {
            showToast(
                result === 'deferred'
                    ? {
                          title: t('cloud_backup.contacts.back_up_deferred'),
                          body: '',
                          type: 'info',
                      }
                    : {
                          title: t(TOAST_KEY[action].success),
                          body: '',
                          type: 'success',
                      },
            )
        },
        onError: (error, { action, id }) => {
            logger.warn('useBackupContactReview: review action failed', {
                action,
                address: id,
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
    })

    const notBackedUpAddresses = useMemo(
        () => new Set(review.notBackedUp),
        [review.notBackedUp],
    )

    return {
        contacts,
        backedUpContacts: useMemo(
            () => contacts.filter(c => review.backedUp.has(c.backupAddress)),
            [contacts, review.backedUp],
        ),
        notBackedUpContacts: useMemo(
            () =>
                contacts.filter(c => notBackedUpAddresses.has(c.backupAddress)),
            [contacts, notBackedUpAddresses],
        ),
        availableFromBackup: review.availableFromBackup,
        isBackedUp: useCallback(
            (address: string) => review.backedUp.has(address),
            [review.backedUp],
        ),
        isBusy: useCallback(
            (address: string) =>
                busyItems.includes(backupBusyItemKey('contact', address)),
            [busyItems],
        ),
        backUpContact: useCallback(
            (address: string) => mutate({ action: 'backUp', id: address }),
            [mutate],
        ),
        addFromBackup: useCallback(
            (address: string) => mutate({ action: 'add', id: address }),
            [mutate],
        ),
        deleteFromBackup: useCallback(
            (address: string) => mutate({ action: 'delete', id: address }),
            [mutate],
        ),
    }
}
