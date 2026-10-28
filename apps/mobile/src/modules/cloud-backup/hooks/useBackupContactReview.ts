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
    contactAddressEntries,
    deriveBackupContactReview,
    backupBusyItemKey,
    useBackupReviewActionMutation,
    useBackupSyncActivityStore,
    useBackupSyncStateStore,
    type BackupContactReview,
    type BackupReviewAction,
} from '@perawallet/wallet-core-backup'
import { i18nKey, type I18nKey } from '@perawallet/wallet-core-chain-contract'
import { NoConnectionError, logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useErrorToast } from '@hooks/useErrorToast'

/** `address` is the one the row shows: the first in `CHAIN_FAMILIES` order. */
export type BackupContact = Contact & { address: string }

export type UseBackupContactReviewResult = {
    contacts: BackupContact[]
    backedUpContacts: BackupContact[]
    notBackedUpContacts: BackupContact[]
    /** Contacts the backup holds that this device deleted, with their names. */
    availableFromBackup: BackupContactReview['availableFromBackup']
    isBackedUp: (id: string) => boolean
    /** True while a review action on this row is queued or running, even
     *  one started before the screen was last opened. */
    isBusy: (id: string) => boolean
    backUpContact: (id: string) => void
    addFromBackup: (id: string) => void
    deleteFromBackup: (id: string) => void
}

const TOAST_KEY: Record<
    BackupReviewAction,
    { success: I18nKey; error: I18nKey }
> = {
    backUp: {
        success: i18nKey('cloud_backup.contacts.back_up_success'),
        error: i18nKey('cloud_backup.contacts.back_up_error'),
    },
    add: {
        success: i18nKey('cloud_backup.contacts.add_success'),
        error: i18nKey('cloud_backup.contacts.add_error'),
    },
    delete: {
        success: i18nKey('cloud_backup.contacts.delete_success'),
        error: i18nKey('cloud_backup.contacts.delete_error'),
    },
}

export const useBackupContactReview = (): UseBackupContactReviewResult => {
    const { t } = useLanguage()
    const { showToast, errorToast } = useToast()
    const { showError } = useErrorToast()
    const busyItems = useBackupSyncActivityStore(state => state.busyItems)
    const storedContacts = useContactsStore(state => state.contacts)
    const contacts = useMemo(
        () =>
            storedContacts.flatMap(contact => {
                const [first] = contactAddressEntries(contact.addresses)
                return first ? [{ ...contact, address: first.address }] : []
            }),
        [storedContacts],
    )
    const syncState = useBackupSyncStateStore(state => state.syncState)

    const review = useMemo(
        () =>
            deriveBackupContactReview(
                syncState,
                storedContacts.map(contact => contact.id),
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
                id,
                error: error instanceof Error ? error.message : String(error),
            })
            if (error instanceof NoConnectionError) {
                showError(error)
                return
            }
            errorToast(t(TOAST_KEY[action].error), '')
        },
    })

    const notBackedUpIds = useMemo(
        () => new Set(review.notBackedUp),
        [review.notBackedUp],
    )

    return {
        contacts,
        backedUpContacts: useMemo(
            () => contacts.filter(c => review.backedUp.has(c.id)),
            [contacts, review.backedUp],
        ),
        notBackedUpContacts: useMemo(
            () => contacts.filter(c => notBackedUpIds.has(c.id)),
            [contacts, notBackedUpIds],
        ),
        availableFromBackup: review.availableFromBackup,
        isBackedUp: useCallback(
            (id: string) => review.backedUp.has(id),
            [review.backedUp],
        ),
        isBusy: useCallback(
            (id: string) =>
                busyItems.includes(backupBusyItemKey('contact', id)),
            [busyItems],
        ),
        backUpContact: useCallback(
            (id: string) => mutate({ action: 'backUp', id }),
            [mutate],
        ),
        addFromBackup: useCallback(
            (id: string) => mutate({ action: 'add', id }),
            [mutate],
        ),
        deleteFromBackup: useCallback(
            (id: string) => mutate({ action: 'delete', id }),
            [mutate],
        ),
    }
}
