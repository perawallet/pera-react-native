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
import { useMutation } from '@tanstack/react-query'
import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import {
    deriveBackupContactReview,
    getBackupSyncManager,
    useBackupSyncStateStore,
    type BackupContactReview,
} from '@perawallet/wallet-core-backup'
import { logger } from '@perawallet/wallet-core-shared'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

type ReviewAction = 'backUp' | 'add' | 'delete'

export type UseBackupContactReviewResult = {
    contacts: Contact[]
    backedUpContacts: Contact[]
    notBackedUpContacts: Contact[]
    /** Contacts the backup holds that this device deleted, with their names. */
    availableFromBackup: BackupContactReview['availableFromBackup']
    isBackedUp: (address: string) => boolean
    busyAddress: string | null
    backUpContact: (address: string) => void
    addFromBackup: (address: string) => void
    deleteFromBackup: (address: string) => void
}

const TOAST_KEY: Record<ReviewAction, { success: string; error: string }> = {
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
    const [busyAddress, setBusyAddress] = useState<string | null>(null)
    const contacts = useContactsStore(state => state.contacts)
    const syncState = useBackupSyncStateStore(state => state.syncState)

    const addresses = useMemo(
        () => contacts.map(contact => contact.address),
        [contacts],
    )

    const review = useMemo(
        () => deriveBackupContactReview(syncState, addresses),
        [syncState, addresses],
    )

    const { mutate } = useMutation({
        throwOnError: false,
        mutationFn: async ({
            action,
            address,
        }: {
            action: ReviewAction
            address: string
        }): Promise<void> => {
            const manager = getBackupSyncManager()
            switch (action) {
                case 'backUp': {
                    if (!(await manager.backUpContact(address))) {
                        throw new Error('Backup is busy syncing')
                    }
                    break
                }
                case 'add': {
                    const summary = await manager.addContactFromBackup(address)
                    if (summary == null) {
                        throw new Error('Backup is busy syncing')
                    }
                    if (summary.failed.length > 0) {
                        throw new Error(summary.failed[0].reason)
                    }
                    break
                }
                case 'delete': {
                    if (!(await manager.deleteContactFromBackup(address))) {
                        throw new Error('Backup is busy syncing')
                    }
                    break
                }
            }
        },
        onMutate: ({ address }) => setBusyAddress(address),
        onSuccess: (_result, { action }) => {
            showToast({
                title: t(TOAST_KEY[action].success),
                body: '',
                type: 'success',
            })
        },
        onError: (error, { action, address }) => {
            logger.warn('useBackupContactReview: review action failed', {
                action,
                address,
                error: error instanceof Error ? error.message : String(error),
            })
            showToast({
                title: t(TOAST_KEY[action].error),
                body: '',
                type: 'error',
            })
        },
        onSettled: () => setBusyAddress(null),
    })

    const notBackedUpAddresses = useMemo(
        () => new Set(review.notBackedUp),
        [review.notBackedUp],
    )

    return {
        contacts,
        backedUpContacts: useMemo(
            () => contacts.filter(c => review.backedUp.has(c.address)),
            [contacts, review.backedUp],
        ),
        notBackedUpContacts: useMemo(
            () => contacts.filter(c => notBackedUpAddresses.has(c.address)),
            [contacts, notBackedUpAddresses],
        ),
        availableFromBackup: review.availableFromBackup,
        isBackedUp: useCallback(
            (address: string) => review.backedUp.has(address),
            [review.backedUp],
        ),
        busyAddress,
        backUpContact: useCallback(
            (address: string) => mutate({ action: 'backUp', address }),
            [mutate],
        ),
        addFromBackup: useCallback(
            (address: string) => mutate({ action: 'add', address }),
            [mutate],
        ),
        deleteFromBackup: useCallback(
            (address: string) => mutate({ action: 'delete', address }),
            [mutate],
        ),
    }
}
